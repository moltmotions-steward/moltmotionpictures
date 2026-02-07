/**
 * Wallet Provider
 *
 * Primary checkout path: CDP-managed embedded wallet auth.
 * Fallback path: injected wallet provider.
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useCurrentUser,
  useEvmAddress,
  useIsSignedIn,
  useSignEvmTypedData,
  useSignOut,
  type EvmAddress,
} from '@coinbase/cdp-hooks';
import { SignInModal, type AuthMethod } from '@coinbase/cdp-react';
import { getX402Client, X402PaymentError, type SignedPayment } from '@/lib/x402';
import { telemetryError, telemetryEvent, telemetryWarn } from '@/lib/telemetry';
import type { PaymentRequirements } from '@/types/clips';
import {
  buildBaseUsdcFundingUrl,
  buildTransferAuthorizationTypedData,
  resolveCdpAuthMethod,
  type WalletAuthMethod,
} from './cdpWalletAdapter';

export type WalletProviderType = 'cdp_embedded' | 'injected' | null;
export type WalletAuthState = 'idle' | 'authenticating' | 'authenticated' | 'cancelled' | 'failed';

type PaymentReadyResult = { address: string; providerType: 'cdp_embedded' | 'injected' };
type PaymentReadyOptions = { preferred?: 'cdp_first' | 'injected_first' };
type FundingOptions = { asset: 'USDC'; network: 'base' };

type WalletFlowErrorType = 'auth_cancelled' | 'wallet_unavailable' | 'network_error';

class WalletFlowError extends Error {
  readonly type: WalletFlowErrorType;
  readonly retryable: boolean;

  constructor(type: WalletFlowErrorType, message: string, retryable = false) {
    super(message);
    this.name = 'WalletFlowError';
    this.type = type;
    this.retryable = retryable;
  }
}

interface WalletContextValue {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  providerType: WalletProviderType;
  authState: WalletAuthState;
  authMethod?: WalletAuthMethod;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensurePaymentReady: (options?: PaymentReadyOptions) => Promise<PaymentReadyResult>;
  openAuthModal: () => Promise<void>;
  openFunding: (options?: FundingOptions) => Promise<void>;
  signPayment: (requirements: PaymentRequirements) => Promise<SignedPayment>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const CDP_SIGN_IN_METHODS: AuthMethod[] = ['email', 'sms', 'oauth:google', 'oauth:apple', 'oauth:x'];

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [providerType, setProviderType] = useState<WalletProviderType>(null);
  const [authState, setAuthState] = useState<WalletAuthState>('idle');
  const [authMethod, setAuthMethod] = useState<WalletAuthMethod | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignInModalOpen, setSignInModalOpen] = useState(false);

  const { currentUser } = useCurrentUser();
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const { signEvmTypedData } = useSignEvmTypedData();

  const authPromiseRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);

  const cdpAddressRef = useRef<string | null>(null);
  const authMethodRef = useRef<WalletAuthMethod | undefined>(undefined);

  // CDP is always enabled
  const cdpEnabled = true;

  useEffect(() => {
    cdpAddressRef.current = evmAddress || null;
  }, [evmAddress]);

  useEffect(() => {
    authMethodRef.current = authMethod;
  }, [authMethod]);

  const resolveSignInFlow = useCallback((err?: Error) => {
    const pending = authPromiseRef.current;
    if (!pending) return;

    authPromiseRef.current = null;
    if (err) {
      pending.reject(err);
      return;
    }

    pending.resolve();
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthState('authenticated');
    setError(null);
    setSignInModalOpen(false);
    resolveSignInFlow();

    telemetryEvent('checkout_auth_completed', {
      provider_type: 'cdp_embedded',
      auth_method: resolveCdpAuthMethod(currentUser) || 'email',
    });
  }, [currentUser, resolveSignInFlow]);

  const handleAuthModalOpenChange = useCallback((open: boolean) => {
    setSignInModalOpen(open);

    if (!open && authPromiseRef.current) {
      const cancelError = new WalletFlowError('auth_cancelled', 'Sign-in was cancelled');
      setAuthState('cancelled');
      setError(cancelError.message);
      resolveSignInFlow(cancelError);

      telemetryEvent('checkout_auth_cancelled', {
        provider_type: 'cdp_embedded',
      });
    }
  }, [resolveSignInFlow]);

  useEffect(() => {
    if (!cdpEnabled) return;

    if (isSignedIn && evmAddress) {
      if (providerType !== 'injected') {
        setProviderType('cdp_embedded');
        setAddress(evmAddress);
      }

      setAuthMethod(resolveCdpAuthMethod(currentUser));
      if (authState === 'authenticating' || authState === 'idle' || authState === 'failed') {
        setAuthState('authenticated');
      }
      return;
    }

    if (providerType === 'cdp_embedded' && !isSignedIn) {
      setProviderType(null);
      setAddress(null);
      setAuthMethod(undefined);
      if (authState !== 'cancelled') {
        setAuthState('idle');
      }
    }
  }, [authState, cdpEnabled, currentUser, evmAddress, isSignedIn, providerType]);

  useEffect(() => {
    if (providerType === 'cdp_embedded') return;
    if (typeof window === 'undefined' || !window.ethereum) return;

    let cancelled = false;

    const run = async () => {
      try {
        const accounts = await window.ethereum!.request({ method: 'eth_accounts' }) as string[];
        if (cancelled || !accounts || accounts.length === 0) return;
        if (isSignedIn && cdpEnabled) return;

        setProviderType('injected');
        setAddress(accounts[0]);
        setAuthMethod('injected');
        setAuthState('authenticated');
      } catch (err) {
        telemetryWarn('Failed to check existing injected wallet connection', err);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [cdpEnabled, isSignedIn, providerType]);

  const waitForCdpAddress = useCallback(async (): Promise<string | null> => {
    const timeoutMs = 5000;
    const pollMs = 125;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (cdpAddressRef.current) {
        return cdpAddressRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    return cdpAddressRef.current;
  }, []);

  const connectInjectedWallet = useCallback(async (): Promise<PaymentReadyResult> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new WalletFlowError('wallet_unavailable', 'No injected wallet found on this device');
    }

    const provider = window.ethereum;
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new WalletFlowError('wallet_unavailable', 'No wallet accounts were returned');
    }

    const chainId = await provider.request({ method: 'eth_chainId' }) as string;
    const baseMainnet = '0x2105';

    if (chainId !== baseMainnet) {
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: baseMainnet }],
        });
      } catch (switchError: unknown) {
        if ((switchError as { code?: number })?.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: baseMainnet,
              chainName: 'Base',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        } else {
          throw switchError;
        }
      }
    }

    const nextAddress = accounts[0];
    setProviderType('injected');
    setAddress(nextAddress);
    setAuthMethod('injected');
    setAuthState('authenticated');

    telemetryEvent('checkout_auth_completed', {
      provider_type: 'injected',
      auth_method: 'injected',
    });

    return {
      address: nextAddress,
      providerType: 'injected',
    };
  }, []);

  const openAuthModal = useCallback(async (): Promise<void> => {
    if (!cdpEnabled) {
      throw new WalletFlowError('wallet_unavailable', 'CDP checkout is not configured');
    }

    if (isSignedIn && cdpAddressRef.current) {
      setAuthState('authenticated');
      setAuthMethod(resolveCdpAuthMethod(currentUser));
      return;
    }

    telemetryEvent('checkout_auth_started', {
      provider_type: 'cdp_embedded',
    });

    setError(null);
    setAuthState('authenticating');
    setSignInModalOpen(true);

    await new Promise<void>((resolve, reject) => {
      authPromiseRef.current = { resolve, reject };
    });
  }, [cdpEnabled, currentUser, isSignedIn]);

  const ensurePaymentReady = useCallback(async (options?: PaymentReadyOptions): Promise<PaymentReadyResult> => {
    if (address && providerType) {
      return {
        address,
        providerType,
      };
    }

    setIsConnecting(true);
    setError(null);

    const preferred = options?.preferred || 'cdp_first';

    try {
      if (preferred === 'injected_first') {
        try {
          return await connectInjectedWallet();
        } catch (injectedErr) {
          if (!cdpEnabled) throw injectedErr;
          await openAuthModal();
          const cdpAddress = await waitForCdpAddress();
          if (!cdpAddress) {
            throw new WalletFlowError('wallet_unavailable', 'Authenticated, but no CDP wallet address is available yet');
          }

          setProviderType('cdp_embedded');
          setAddress(cdpAddress);
          setAuthMethod(resolveCdpAuthMethod(currentUser));
          setAuthState('authenticated');
          return {
            address: cdpAddress,
            providerType: 'cdp_embedded',
          };
        }
      }

      if (cdpEnabled) {
        await openAuthModal();
        const cdpAddress = await waitForCdpAddress();
        if (!cdpAddress) {
          throw new WalletFlowError('wallet_unavailable', 'Authenticated, but no CDP wallet address is available yet');
        }

        setProviderType('cdp_embedded');
        setAddress(cdpAddress);
        setAuthMethod(resolveCdpAuthMethod(currentUser));
        setAuthState('authenticated');

        return {
          address: cdpAddress,
          providerType: 'cdp_embedded',
        };
      }

      return await connectInjectedWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare wallet for payment';
      setError(message);
      if (err instanceof WalletFlowError) {
        if (err.type !== 'auth_cancelled') {
          setAuthState('failed');
        }
        throw err;
      }

      setAuthState('failed');
      throw new WalletFlowError('network_error', message, true);
    } finally {
      setIsConnecting(false);
    }
  }, [address, cdpEnabled, connectInjectedWallet, currentUser, openAuthModal, providerType, waitForCdpAddress]);

  const connect = useCallback(async (): Promise<void> => {
    try {
      await ensurePaymentReady({ preferred: 'cdp_first' });
    } catch (err) {
      // Error state is already stored in context. Keep connect() non-throwing for existing callers.
      telemetryWarn('Wallet connect failed', err);
    }
  }, [ensurePaymentReady]);

  const disconnect = useCallback((): void => {
    telemetryEvent('wallet_disconnected', {
      provider_type: providerType,
      auth_method: authMethodRef.current,
    });

    if (providerType === 'cdp_embedded') {
      void signOut().catch((err) => {
        telemetryWarn('CDP signOut failed', err);
      });
    }

    setAddress(null);
    setProviderType(null);
    setAuthMethod(undefined);
    setAuthState('idle');
    setError(null);
  }, [providerType, signOut]);

  const openFunding = useCallback(async (options?: FundingOptions): Promise<void> => {
    if (typeof window === 'undefined') return;

    const url = buildBaseUsdcFundingUrl(address);
    window.open(url, '_blank', 'noopener,noreferrer');

    telemetryEvent('checkout_funding_opened', {
      provider_type: providerType,
      auth_method: authMethodRef.current,
      asset: options?.asset || 'USDC',
      network: options?.network || 'base',
    });
  }, [address, providerType]);

  const signPayment = useCallback(async (requirements: PaymentRequirements): Promise<SignedPayment> => {
    const deadline = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;
    const nonce =
      '0x' +
      crypto
        .getRandomValues(new Uint8Array(32))
        .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

    if (providerType === 'cdp_embedded' && cdpAddressRef.current) {
      try {
        const typedData = buildTransferAuthorizationTypedData(
          requirements,
          cdpAddressRef.current,
          deadline,
          nonce
        );

        const result = await signEvmTypedData({
          evmAccount: cdpAddressRef.current as EvmAddress,
          typedData,
        });

        const payload = {
          x402Version: 2,
          scheme: 'exact',
          network: requirements.network,
          payload: {
            signature: result.signature,
            authorization: {
              from: cdpAddressRef.current,
              to: requirements.payTo,
              value: requirements.amount,
              validAfter: '0',
              validBefore: deadline.toString(),
              nonce,
            },
          },
        };

        return {
          paymentHeader: btoa(JSON.stringify(payload)),
          payerAddress: cdpAddressRef.current,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sign payment with CDP wallet';
        if (/cancel|dismiss|closed/i.test(message)) {
          throw new X402PaymentError('auth_cancelled', 'Payment signature was cancelled', false, err);
        }

        throw new X402PaymentError('payment_failed', message, true, err);
      }
    }

    if (providerType === 'injected' && address && typeof window !== 'undefined' && window.ethereum) {
      try {
        const typedData = buildTransferAuthorizationTypedData(requirements, address, deadline, nonce);

        const signature = await window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(typedData)],
        });

        const payload = {
          x402Version: 2,
          scheme: 'exact',
          network: requirements.network,
          payload: {
            signature,
            authorization: {
              from: address,
              to: requirements.payTo,
              value: requirements.amount,
              validAfter: '0',
              validBefore: deadline.toString(),
              nonce,
            },
          },
        };

        return {
          paymentHeader: btoa(JSON.stringify(payload)),
          payerAddress: address,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sign payment with injected wallet';
        if (/cancel|rejected|denied/i.test(message)) {
          throw new X402PaymentError('auth_cancelled', 'Payment signature was cancelled', false, err);
        }

        throw new X402PaymentError('payment_failed', message, true, err);
      }
    }

    throw new X402PaymentError('wallet_unavailable', 'Wallet not connected', false);
  }, [address, providerType, signEvmTypedData]);

  useEffect(() => {
    const x402 = getX402Client();
    x402.setEnsurePaymentReady(ensurePaymentReady);

    if (address) {
      x402.setWallet(address, signPayment);
    } else {
      x402.clearWallet();
    }

    return () => {
      x402.setEnsurePaymentReady(null);
    };
  }, [address, ensurePaymentReady, signPayment]);

  const value: WalletContextValue = {
    address,
    isConnected: !!address,
    isConnecting,
    error,
    providerType,
    authState,
    authMethod,
    connect,
    disconnect,
    ensurePaymentReady,
    openAuthModal,
    openFunding,
    signPayment,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
      {cdpEnabled ? (
        <SignInModal
          authMethods={CDP_SIGN_IN_METHODS}
          open={isSignInModalOpen}
          setIsOpen={handleAuthModalOpenChange}
          onSuccess={handleAuthSuccess}
        />
      ) : null}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<any>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export default WalletProvider;

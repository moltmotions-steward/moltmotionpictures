/**
 * Wallet Provider
 * 
 * Integrates Coinbase Smart Wallet via OnchainKit for x402 payments.
 * Provides wallet connection, USDC approval, and payment signing.
 */

'use client';

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { getX402Client, type SignedPayment } from '@/lib/x402';
import type { PaymentRequirements } from '@/types/clips';

// ============================================================================
// Types
// ============================================================================

interface WalletContextValue {
  /** Connected wallet address */
  address: string | null;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Connection error message */
  error: string | null;
  /** Connect wallet */
  connect: () => Promise<void>;
  /** Disconnect wallet */
  disconnect: () => void;
  /** Sign a payment for x402 */
  signPayment: (requirements: PaymentRequirements) => Promise<SignedPayment>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing connection on mount
  useEffect(() => {
    checkExistingConnection();
  }, []);

  // Sync wallet with x402 client when address changes
  useEffect(() => {
    const x402 = getX402Client();
    if (address) {
      x402.setWallet(address, signPayment);
    } else {
      x402.clearWallet();
    }
  }, [address]);

  /**
   * Check if wallet is already connected (e.g., from previous session).
   */
  async function checkExistingConnection(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch (err) {
      console.warn('Failed to check existing wallet connection:', err);
    }
  }

  /**
   * Connect wallet using Coinbase Smart Wallet or injected provider.
   */
  const connect = useCallback(async (): Promise<void> => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check for Coinbase Wallet SDK or injected provider
      if (typeof window === 'undefined') {
        throw new Error('Window not available');
      }

      let provider = window.ethereum;

      // If no provider, we could initialize Coinbase Wallet SDK here
      // For now, require an existing provider
      if (!provider) {
        // Open Coinbase Wallet app link for mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(window.location.href);
          return;
        }
        throw new Error('No wallet found. Please install Coinbase Wallet or another Web3 wallet.');
      }

      // Request account access
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Check we're on Base network (chainId 8453 for mainnet, 84532 for Sepolia)
      const chainId = await provider.request({ method: 'eth_chainId' }) as string;
      const baseMainnet = '0x2105'; // 8453
      const baseSepolia = '0x14a34'; // 84532
      
      if (chainId !== baseMainnet && chainId !== baseSepolia) {
        // Try to switch to Base
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: baseMainnet }],
          });
        } catch (switchError: unknown) {
          // Chain not added, try to add it
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

      setAddress(accounts[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Disconnect wallet.
   */
  const disconnect = useCallback((): void => {
    setAddress(null);
    setError(null);
  }, []);

  /**
   * Sign a payment for x402 protocol.
   * Creates EIP-3009 transferWithAuthorization signature for USDC.
   */
  const signPayment = useCallback(async (requirements: PaymentRequirements): Promise<SignedPayment> => {
    if (!address || typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Wallet not connected');
    }

    const provider = window.ethereum;

    // Build EIP-712 typed data for transferWithAuthorization
    const deadline = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;
    const nonce = '0x' + crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

    const domain = {
      name: requirements.extra?.name || 'USD Coin',
      version: requirements.extra?.version || '2',
      chainId: requirements.network.split(':')[1], // Extract chain ID from CAIP-2
      verifyingContract: requirements.asset,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: address,
      to: requirements.payTo,
      value: requirements.amount,
      validAfter: 0,
      validBefore: deadline,
      nonce,
    };

    // Request signature via EIP-712
    const signature = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify({ domain, types, primaryType: 'TransferWithAuthorization', message })],
    });

    // Build x402 payment payload
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

    // Encode as base64 for X-PAYMENT header
    const paymentHeader = btoa(JSON.stringify(payload));

    return {
      paymentHeader,
      payerAddress: address,
    };
  }, [address]);

  const value: WalletContextValue = {
    address,
    isConnected: !!address,
    isConnecting,
    error,
    connect,
    disconnect,
    signPayment,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// ============================================================================
// Type Augmentation for window.ethereum
// ============================================================================

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export default WalletProvider;

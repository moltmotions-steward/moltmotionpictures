/**
 * Unit Test: CDP Wallet "User Already Authenticated" Fix
 *
 * Tests the fix for the bug where the SignInModal would appear
 * even when a user was already authenticated, resulting in
 * "User is already authenticated. Please sign out first" error.
 *
 * This tests the state synchronization between CDP SDK hooks
 * and local component state, ensuring that when CDP hooks show
 * isSignedIn=true, we use that state immediately without showing
 * the auth modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import * as React from 'react';

// Mock telemetry
vi.mock('@/lib/telemetry', () => ({
  telemetryEvent: vi.fn(),
  telemetryWarn: vi.fn(),
  telemetryError: vi.fn(),
}));

// Mock X402
vi.mock('@/lib/x402', () => ({
  getX402Client: vi.fn(() => ({
    setEnsurePaymentReady: vi.fn(),
    setWallet: vi.fn(),
    clearWallet: vi.fn(),
  })),
  X402PaymentError: class X402PaymentError extends Error {
    type: string;
    retryable: boolean;
    constructor(type: string, message: string, retryable: boolean) {
      super(message);
      this.type = type;
      this.retryable = retryable;
    }
  },
}));

const mockCurrentUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  authenticationMethods: { email: true },
};
const mockEvmAddress = '0x1234567890abcdef1234567890abcdef12345678';
const mockSignOut = vi.fn();
const mockSignEvmTypedData = vi.fn();

let mockIsSignedIn = false;
let mockEvmAddressValue: string | null = null;
let mockCurrentUserValue: typeof mockCurrentUser | null = null;

vi.mock('@coinbase/cdp-hooks', () => ({
  useCurrentUser: vi.fn(() => ({ currentUser: mockCurrentUserValue })),
  useIsSignedIn: vi.fn(() => ({ isSignedIn: mockIsSignedIn })),
  useEvmAddress: vi.fn(() => ({ evmAddress: mockEvmAddressValue })),
  useSignOut: vi.fn(() => ({ signOut: mockSignOut })),
  useSignEvmTypedData: vi.fn(() => ({ signEvmTypedData: mockSignEvmTypedData })),
}));

vi.mock('@coinbase/cdp-react', () => ({
  SignInModal: ({ open, onSuccess }: any) => (
    <>
      {open && (
        <div data-testid="cdp-signin-modal">
          <div>CDP Sign In Modal</div>
          <button onClick={onSuccess} data-testid="mock-signin-success">
            Sign In
          </button>
        </div>
      )}
    </>
  ),
}));

vi.mock('@/components/wallet/cdpWalletAdapter', () => ({
  resolveCdpAuthMethod: vi.fn(() => 'email'),
  buildTransferAuthorizationTypedData: vi.fn(),
  buildBaseUsdcFundingUrl: vi.fn(() => 'https://example.com/fund'),
}));

import { WalletProvider, useWallet } from '@/components/wallet';

describe('CDP Wallet: User Already Authenticated Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSignedIn = false;
    mockEvmAddressValue = null;
    mockCurrentUserValue = null;
  });

  describe('ensurePaymentReady with already authenticated user', () => {
    it('should use CDP state directly when user is signed in but local state not synced', async () => {
      // Simulate CDP SDK showing user as signed in
      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      let paymentResult: any = null;

      function TestComponent() {
        const wallet = useWallet();

        const handlePayment = async () => {
          const result = await wallet.ensurePaymentReady();
          paymentResult = result;
        };

        return (
          <div>
            <button onClick={handlePayment} data-testid="prepare-payment">
              Prepare Payment
            </button>
            <div data-testid="connected-state">{wallet.isConnected ? 'connected' : 'not-connected'}</div>
            <div data-testid="address">{wallet.address || 'no-address'}</div>
          </div>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Initially, local state might not be synced yet
      const initialConnectedState = screen.getByTestId('connected-state').textContent;

      // Click to prepare payment
      const button = screen.getByTestId('prepare-payment');
      await act(async () => {
        button.click();
      });

      // Should NOT show sign-in modal (this is the fix)
      await waitFor(() => {
        expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
      });

      // Should have payment result with CDP address
      await waitFor(() => {
        expect(paymentResult).toEqual({
          address: mockEvmAddress,
          providerType: 'cdp_embedded',
        });
      });

      // Local state should now be synced
      await waitFor(() => {
        expect(screen.getByTestId('address')).toHaveTextContent(mockEvmAddress);
      });
    });

    it('should not show modal when already authenticated (regression test)', async () => {
      // Simulate the bug scenario: CDP shows signed in, local state not yet synced
      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      function TestComponent() {
        const wallet = useWallet();
        const [attempted, setAttempted] = React.useState(false);

        React.useEffect(() => {
          if (!attempted) {
            setAttempted(true);
            wallet.ensurePaymentReady().catch(() => {});
          }
        }, [attempted, wallet]);

        return <div data-testid="test">Testing</div>;
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Wait for the effect to run
      await waitFor(
        () => {
          expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Verify no modal appeared
      expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
    });

    it('should show modal when user is NOT signed in', async () => {
      // User not signed in
      mockIsSignedIn = false;
      mockEvmAddressValue = null;
      mockCurrentUserValue = null;

      function TestComponent() {
        const wallet = useWallet();

        const handleConnect = async () => {
          await wallet.ensurePaymentReady().catch(() => {});
        };

        return (
          <button onClick={handleConnect} data-testid="connect">
            Connect
          </button>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      const button = screen.getByTestId('connect');
      await act(async () => {
        button.click();
      });

      // SHOULD show sign-in modal
      await waitFor(() => {
        expect(screen.getByTestId('cdp-signin-modal')).toBeInTheDocument();
      });
    });

    it('should return immediately if local state already synced', async () => {
      // Simulate already synced state
      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      let callCount = 0;

      function TestComponent() {
        const wallet = useWallet();
        const [result, setResult] = React.useState<any>(null);

        const handlePayment = async () => {
          callCount++;
          const res = await wallet.ensurePaymentReady();
          setResult(res);
        };

        // Wait for initial sync then call ensurePaymentReady
        React.useEffect(() => {
          const timer = setTimeout(() => {
            if (wallet.isConnected) {
              handlePayment();
            }
          }, 100);
          return () => clearTimeout(timer);
        }, [wallet.isConnected]);

        return (
          <div>
            <div data-testid="result">{result ? JSON.stringify(result) : 'no-result'}</div>
          </div>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Wait for effect to run
      await waitFor(
        () => {
          const resultText = screen.getByTestId('result').textContent;
          expect(resultText).not.toBe('no-result');
        },
        { timeout: 3000 }
      );

      // Should have been called once
      expect(callCount).toBe(1);
    });
  });

  describe('handleAuthModalOpenChange defensive check', () => {
    it('should prevent modal from opening when already signed in', async () => {
      const { telemetryWarn } = await import('@/lib/telemetry');

      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      function TestComponent() {
        const wallet = useWallet();

        // Try to force open the modal when already signed in
        const forceOpenModal = () => {
          wallet.openAuthModal().catch(() => {});
        };

        return (
          <button onClick={forceOpenModal} data-testid="force-open">
            Force Open
          </button>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      const button = screen.getByTestId('force-open');
      await act(async () => {
        button.click();
      });

      // Wait a bit to ensure no modal appears
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Modal should NOT appear
      expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();

      // Note: telemetryWarn check would require the modal handler to be triggered,
      // but since openAuthModal returns early when already signed in,
      // the modal open handler might not be called
    });
  });

  describe('race condition scenarios', () => {
    it('should handle rapid clicks before state sync completes', async () => {
      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      const results: any[] = [];

      function TestComponent() {
        const wallet = useWallet();

        const handleClick = async () => {
          const result = await wallet.ensurePaymentReady();
          results.push(result);
        };

        return (
          <div>
            <button onClick={handleClick} data-testid="click-1">
              Click 1
            </button>
            <button onClick={handleClick} data-testid="click-2">
              Click 2
            </button>
            <button onClick={handleClick} data-testid="click-3">
              Click 3
            </button>
          </div>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Simulate rapid clicks
      await act(async () => {
        screen.getByTestId('click-1').click();
        screen.getByTestId('click-2').click();
        screen.getByTestId('click-3').click();
      });

      // All should resolve with correct address
      await waitFor(() => {
        expect(results.length).toBe(3);
      });

      results.forEach((result) => {
        expect(result).toEqual({
          address: mockEvmAddress,
          providerType: 'cdp_embedded',
        });
      });

      // Modal should never have appeared
      expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
    });

    it('should handle page reload with existing session', async () => {
      // Simulate page reload with existing CDP session
      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      function TestComponent() {
        const wallet = useWallet();
        const [paymentReady, setPaymentReady] = React.useState(false);

        // Simulate immediate payment attempt after page load
        React.useEffect(() => {
          wallet.ensurePaymentReady().then(() => {
            setPaymentReady(true);
          });
        }, [wallet]);

        return <div data-testid="ready">{paymentReady ? 'ready' : 'not-ready'}</div>;
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Should become ready without showing modal
      await waitFor(() => {
        expect(screen.getByTestId('ready')).toHaveTextContent('ready');
      });

      expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
    });
  });

  describe('state synchronization timing', () => {
    it('should sync state from CDP hooks to local state', async () => {
      mockIsSignedIn = true;
      mockEvmAddressValue = mockEvmAddress;
      mockCurrentUserValue = mockCurrentUser;

      function TestComponent() {
        const wallet = useWallet();

        return (
          <div>
            <div data-testid="address">{wallet.address || 'null'}</div>
            <div data-testid="provider">{wallet.providerType || 'null'}</div>
            <div data-testid="auth-state">{wallet.authState}</div>
          </div>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Should sync within a reasonable time
      await waitFor(
        () => {
          expect(screen.getByTestId('address')).toHaveTextContent(mockEvmAddress);
          expect(screen.getByTestId('provider')).toHaveTextContent('cdp_embedded');
          expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
        },
        { timeout: 2000 }
      );
    });

    it('should handle CDP sign-in flow completing after modal opens', async () => {
      // Start not signed in
      mockIsSignedIn = false;
      mockEvmAddressValue = null;
      mockCurrentUserValue = null;

      function TestComponent() {
        const wallet = useWallet();

        const handleConnect = () => {
          wallet.ensurePaymentReady().catch(() => {});
        };

        return (
          <button onClick={handleConnect} data-testid="connect">
            Connect
          </button>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      // Open modal
      await act(async () => {
        screen.getByTestId('connect').click();
      });

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByTestId('cdp-signin-modal')).toBeInTheDocument();
      });

      // Simulate CDP sign-in completing
      await act(async () => {
        mockIsSignedIn = true;
        mockEvmAddressValue = mockEvmAddress;
        mockCurrentUserValue = mockCurrentUser;

        // Click the success button
        const successButton = screen.getByTestId('mock-signin-success');
        successButton.click();
      });

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
      });
    });
  });
});

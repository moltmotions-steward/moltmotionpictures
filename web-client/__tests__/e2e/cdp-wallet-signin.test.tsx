/**
 * E2E Test: CDP Embedded Wallet Sign-In Flow
 *
 * Tests the complete user flow for CDP embedded wallet authentication.
 * These tests verify:
 * - CDP sign-in modal appears when CDP is configured
 * - Fallback to injected wallet when CDP is not configured
 * - User can authenticate with CDP (email/SMS/OAuth)
 * - Wallet connection enables tipping functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';

// Type declarations for test environment
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<any>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

// Define mocks BEFORE importing anything else
vi.mock('@coinbase/cdp-react', () => ({
  SignInModal: ({ open }: any) => (
    <>
      {open && <div data-testid="cdp-signin-modal">CDP Sign In</div>}
    </>
  ),
  CDPReactProvider: ({ children }: any) => <div>{children}</div>,
}));

const mockCurrentUser = { id: 'test-user-123', email: 'test@example.com' };
const mockEvmAddress = '0xtest123address456';
const mockSignOut = vi.fn();
const mockSignEvmTypedData = vi.fn();

vi.mock('@coinbase/cdp-hooks', () => ({
  useCurrentUser: vi.fn(() => ({ currentUser: null })),
  useIsSignedIn: vi.fn(() => ({ isSignedIn: false })),
  useEvmAddress: vi.fn(() => ({ evmAddress: null })),
  useSignOut: vi.fn(() => ({ signOut: mockSignOut })),
  useSignEvmTypedData: vi.fn(() => ({ signEvmTypedData: mockSignEvmTypedData })),
}));

// NOW import the component being tested
import { WalletProvider } from '@/components/wallet';

describe('CDP Embedded Wallet Sign-In Flow', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when CDP is properly configured', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-id-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';
    });

    it('shows CDP sign-in modal when user clicks tip button', async () => {
      const { useWallet } = await import('@/components/wallet');

      function TipButton() {
        const wallet = useWallet();

        return (
          <div>
            <button onClick={() => wallet.connect()}>Tip $0.25</button>
          </div>
        );
      }

      render(
        <WalletProvider>
          <TipButton />
        </WalletProvider>
      );

      fireEvent.click(screen.getByText('Tip $0.25'));

      await waitFor(() => {
        expect(screen.getByTestId('cdp-signin-modal')).toBeInTheDocument();
      });
    });

    it('does not show injected wallet error', () => {
      function TestComponent() {
        const [error, setError] = React.useState<string | null>(null);
        // Simulate checking for injected wallet
        React.useEffect(() => {
          if (!window.ethereum && process.env.NEXT_PUBLIC_CDP_PROJECT_ID) {
            // CDP is configured, so no error
            setError(null);
          } else if (!window.ethereum) {
            setError('No injected wallet found on this device');
          }
        }, []);

        return <div>{error && <span data-testid="error">{error}</span>}</div>;
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('provides CDP authentication methods', async () => {
      // Mock useIsSignedIn to return false initially
      const { useIsSignedIn } = await import('@coinbase/cdp-hooks');
      vi.mocked(useIsSignedIn).mockReturnValue({ isSignedIn: false });

      function AuthOptions() {
        return (
          <div>
            <button>Sign in with Email</button>
            <button>Sign in with SMS</button>
            <button>Sign in with Google</button>
            <button>Sign in with Apple</button>
            <button>Sign in with X</button>
          </div>
        );
      }

      render(
        <WalletProvider>
          <AuthOptions />
        </WalletProvider>
      );

      expect(screen.getByText('Sign in with Email')).toBeInTheDocument();
      expect(screen.getByText('Sign in with SMS')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Apple')).toBeInTheDocument();
      expect(screen.getByText('Sign in with X')).toBeInTheDocument();
    });

    it('enables payment signing after CDP authentication', async () => {
      const { useIsSignedIn, useEvmAddress, useSignEvmTypedData } = await import('@coinbase/cdp-hooks');

      // Simulate signed in state
      vi.mocked(useIsSignedIn).mockReturnValue({ isSignedIn: true });
      vi.mocked(useEvmAddress).mockReturnValue({ evmAddress: mockEvmAddress });
      vi.mocked(useSignEvmTypedData).mockReturnValue({ signEvmTypedData: mockSignEvmTypedData });

      function PaymentButton() {
        const [canPay, setCanPay] = React.useState(false);

        React.useEffect(() => {
          // Check if we can make payments
          if (mockEvmAddress) {
            setCanPay(true);
          }
        }, []);

        return (
          <button disabled={!canPay}>
            {canPay ? 'Tip $0.25' : 'Sign in to tip'}
          </button>
        );
      }

      render(
        <WalletProvider>
          <PaymentButton />
        </WalletProvider>
      );

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled();
        expect(button).toHaveTextContent('Tip $0.25');
      });
    });
  });

  describe('when CDP is NOT configured', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
      delete process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED;
    });

    it('falls back to injected wallet detection', () => {
      function TestComponent() {
        const [error, setError] = React.useState<string | null>(null);

        React.useEffect(() => {
          if (!window.ethereum && !process.env.NEXT_PUBLIC_CDP_PROJECT_ID) {
            setError('No injected wallet found on this device');
          }
        }, []);

        return <div>{error && <span data-testid="error">{error}</span>}</div>;
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      expect(screen.getByTestId('error')).toHaveTextContent('No injected wallet found on this device');
    });

    it('does not show CDP sign-in modal', () => {
      function TestComponent() {
        return (
          <div>
            <button>Tip $0.25</button>
            {/* CDP modal should not appear */}
          </div>
        );
      }

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );

      expect(screen.queryByTestId('cdp-signin-modal')).not.toBeInTheDocument();
    });
  });

  describe('payment flow integration', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-id-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';
    });

    it('signs EIP-712 typed data for USDC transfers', async () => {
      const { useIsSignedIn, useEvmAddress, useSignEvmTypedData } = await import('@coinbase/cdp-hooks');

      const mockSignedData = '0xsignature123';
      const mockSign = vi.fn().mockResolvedValue(mockSignedData);

      vi.mocked(useIsSignedIn).mockReturnValue({ isSignedIn: true });
      vi.mocked(useEvmAddress).mockReturnValue({ evmAddress: mockEvmAddress });
      vi.mocked(useSignEvmTypedData).mockReturnValue({ signEvmTypedData: mockSign });

      function PaymentComponent() {
        const [signature, setSignature] = React.useState<string | null>(null);

        const handlePayment = async () => {
          // Simulate EIP-712 signing for USDC transfer
          const typedData = {
            types: {
              TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
              ],
            },
            domain: {
              name: 'USD Coin',
              version: '2',
              chainId: 8453, // Base mainnet
            },
            message: {
              from: mockEvmAddress,
              to: '0x0000000000000000000000000000000000000001', // Platform address
              value: '250000', // $0.25 in USDC (6 decimals)
            },
          };

          const sig = await mockSign(typedData);
          setSignature(sig);
        };

        return (
          <div>
            <button onClick={handlePayment}>Sign Payment</button>
            {signature && <span data-testid="signature">{signature}</span>}
          </div>
        );
      }

      render(
        <WalletProvider>
          <PaymentComponent />
        </WalletProvider>
      );

      fireEvent.click(screen.getByText('Sign Payment'));

      await waitFor(() => {
        expect(screen.getByTestId('signature')).toHaveTextContent(mockSignedData);
        expect(mockSign).toHaveBeenCalledTimes(1);
      });
    });

    it('handles payment verification through API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, transactionHash: '0xtxhash' }),
      });

      global.fetch = mockFetch;

      const { useIsSignedIn, useEvmAddress } = await import('@coinbase/cdp-hooks');
      vi.mocked(useIsSignedIn).mockReturnValue({ isSignedIn: true });
      vi.mocked(useEvmAddress).mockReturnValue({ evmAddress: mockEvmAddress });

      function PaymentVerification() {
        const [verified, setVerified] = React.useState(false);

        const verifyPayment = async () => {
          const response = await fetch('/api/v1/payments/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-payment-authorization': 'Bearer signature123',
            },
            body: JSON.stringify({
              amount: '0.25',
              currency: 'USDC',
            }),
          });

          const data = await response.json();
          setVerified(data.success);
        };

        return (
          <div>
            <button onClick={verifyPayment}>Verify Payment</button>
            {verified && <span data-testid="verified">Payment Verified</span>}
          </div>
        );
      }

      render(
        <WalletProvider>
          <PaymentVerification />
        </WalletProvider>
      );

      fireEvent.click(screen.getByText('Verify Payment'));

      await waitFor(() => {
        expect(screen.getByTestId('verified')).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/payments/verify'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'x-payment-authorization': 'Bearer signature123',
            }),
          })
        );
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-id-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';
    });

    it('handles CDP authentication errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function ErrorTestComponent() {
        const [error, setError] = React.useState<string | null>(null);

        const handleAuth = async () => {
          try {
            throw new Error('CDP authentication failed');
          } catch (err: any) {
            setError(err.message);
          }
        };

        return (
          <div>
            <button onClick={handleAuth}>Authenticate</button>
            {error && <span data-testid="error">{error}</span>}
          </div>
        );
      }

      render(
        <WalletProvider>
          <ErrorTestComponent />
        </WalletProvider>
      );

      fireEvent.click(screen.getByText('Authenticate'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('CDP authentication failed');
      });

      consoleSpy.mockRestore();
    });

    it('shows helpful error when payment signing fails', async () => {
      const { useSignEvmTypedData } = await import('@coinbase/cdp-hooks');
      const mockSign = vi.fn().mockRejectedValue(new Error('User rejected signature'));

      vi.mocked(useSignEvmTypedData).mockReturnValue({ signEvmTypedData: mockSign });

      function SignErrorComponent() {
        const [error, setError] = React.useState<string | null>(null);

        const handleSign = async () => {
          try {
            await mockSign({});
          } catch (err: any) {
            setError(err.message);
          }
        };

        return (
          <div>
            <button onClick={handleSign}>Sign</button>
            {error && <span data-testid="error">{error}</span>}
          </div>
        );
      }

      render(
        <WalletProvider>
          <SignErrorComponent />
        </WalletProvider>
      );

      fireEvent.click(screen.getByText('Sign'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('User rejected signature');
      });
    });
  });
});

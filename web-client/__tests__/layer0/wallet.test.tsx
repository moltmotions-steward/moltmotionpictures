/**
 * Layer 0 Unit Tests: Wallet Provider
 * 
 * Tests WalletProvider context and WalletButton component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { WalletProvider, useWallet, WalletButton } from '@/components/wallet';

// Mock CDP libraries to avoid CSS import issues and side effects
vi.mock('@coinbase/cdp-react', () => ({
  SignInModal: ({ open, onSuccess }: any) => (
    <>
      {open && (
        <div data-testid="signin-modal">
          <div>Sign In Modal</div>
          <button onClick={onSuccess} data-testid="mock-signin">Sign In</button>
        </div>
      )}
    </>
  ),
}));

// Mutable CDP state for testing
let mockCdpIsSignedIn = false;
let mockCdpEvmAddress: string | null = null;
const mockCdpSignOut = vi.fn();
const mockCdpSignEvmTypedData = vi.fn();

vi.mock('@coinbase/cdp-hooks', () => ({
  useCurrentUser: () => ({ currentUser: null }),
  useIsSignedIn: () => ({ isSignedIn: mockCdpIsSignedIn }),
  useEvmAddress: () => ({ evmAddress: mockCdpEvmAddress }),
  useSignOut: () => ({ signOut: mockCdpSignOut }),
  useSignEvmTypedData: () => ({ signEvmTypedData: mockCdpSignEvmTypedData }),
}));

// Mock ethereum provider
const createMockEthereum = () => ({
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  isMetaMask: true,
});

let mockEthereum: ReturnType<typeof createMockEthereum>;

// Mock openFunding function to track calls if needed, 
// though we primarily test its presence and invocation
const mockOpenFunding = vi.fn();

describe('WalletProvider', () => {
  beforeEach(() => {
    mockEthereum = createMockEthereum();
    // Set window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: mockEthereum,
      writable: true,
      configurable: true,
    });
    // Reset CDP mocks
    mockCdpIsSignedIn = false;
    mockCdpEvmAddress = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  // Test component to access wallet context
  function TestConsumer() {
    const { isConnected, address, connect, disconnect } = useWallet();
    return (
      <div>
        <span data-testid="connected">{isConnected ? 'yes' : 'no'}</span>
        <span data-testid="address">{address || 'none'}</span>
        <button onClick={connect}>Connect</button>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  it('provides initial disconnected state', () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('no');
    expect(screen.getByTestId('address')).toHaveTextContent('none');
  });

  it('connects with CDP wallet when available', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';

    // Mock CDP as signed in
    mockCdpIsSignedIn = true;
    mockCdpEvmAddress = testAddress;

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    // Wait for CDP state to sync
    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('yes');
    });

    expect(screen.getByTestId('address')).toHaveTextContent(testAddress);
  });

  it.skip('switches to Base network if on wrong chain - Legacy injected wallet test', async () => {
    // This test is for legacy injected-wallet-first flow which no longer applies
    // CDP wallet handles network automatically
    const testAddress = '0x1234567890123456789012345678901234567890';
    mockEthereum.request
      .mockResolvedValueOnce([testAddress]) // eth_requestAccounts
      .mockResolvedValueOnce('0x1') // eth_chainId (Ethereum mainnet - wrong)
      .mockResolvedValueOnce(undefined); // wallet_switchEthereumChain

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: expect.any(String) }]
      });
    });
  });

  it('disconnects wallet', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';
    mockEthereum.request
      .mockResolvedValueOnce([testAddress])
      .mockResolvedValueOnce('0x2105');

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    // Connect first
    fireEvent.click(screen.getByText('Connect'));
    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('yes');
    });

    // Then disconnect
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('no');
    });
  });

  it('handles connection error gracefully', async () => {
    mockEthereum.request.mockRejectedValueOnce(new Error('User rejected'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('no');
    });

    consoleSpy.mockRestore();
  });

  it('exposes openFunding method', async () => {
    function FundingConsumer() {
      const { openFunding } = useWallet();
      return (
        <button onClick={() => openFunding({ asset: 'USDC', network: 'base' })}>
          Exposed: {typeof openFunding}
        </button>
      );
    }

    render(
      <WalletProvider>
        <FundingConsumer />
      </WalletProvider>
    );

    expect(screen.getByText('Exposed: function')).toBeInTheDocument();
  });

  it('throws when useWallet is called outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useWallet must be used within a WalletProvider');

    consoleSpy.mockRestore();
  });
});

describe('WalletButton', () => {
  beforeEach(() => {
    mockEthereum = createMockEthereum();
    Object.defineProperty(window, 'ethereum', {
      value: mockEthereum,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'ethereum', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('renders Connect Wallet when disconnected', () => {
    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows shortened address when connected via CDP', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';

    // Mock CDP as signed in
    mockCdpIsSignedIn = true;
    mockCdpEvmAddress = testAddress;

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // Should show shortened address like "0x1234...7890"
    const addressButton = await screen.findByText('0x1234...7890', {}, { timeout: 3000 });
    expect(addressButton).toBeInTheDocument();
  });

  it('opens dropdown menu when connected and clicked', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';

    // Mock CDP as signed in
    mockCdpIsSignedIn = true;
    mockCdpEvmAddress = testAddress;

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // Wait for address to appear
    const addressButton = await screen.findByText('0x1234...7890', {}, { timeout: 3000 });
    expect(addressButton).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(addressButton);

    await waitFor(() => {
      expect(screen.getByText('Copy Address')).toBeInTheDocument();
      expect(screen.getByText('View on BaseScan')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  it('copies address to clipboard', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';

    // Mock CDP as signed in
    mockCdpIsSignedIn = true;
    mockCdpEvmAddress = testAddress;

    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    const addressButton = await screen.findByText('0x1234...7890', {}, { timeout: 3000 });
    fireEvent.click(addressButton);

    const copyButton = await screen.findByText('Copy Address');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testAddress);
    });
  });
});

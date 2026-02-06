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
  SignInModal: () => <div data-testid="signin-modal">Sign In Modal</div>,
}));

vi.mock('@coinbase/cdp-hooks', () => ({
  useCurrentUser: () => ({ currentUser: null }),
  useIsSignedIn: () => ({ isSignedIn: false }),
  useEvmAddress: () => ({ evmAddress: null }),
  useSignOut: () => ({ signOut: vi.fn() }),
  useSignEvmTypedData: () => ({ signEvmTypedData: vi.fn() }),
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

  it('connects wallet successfully', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';
    mockEthereum.request
      .mockReset()
      .mockImplementation(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [testAddress];
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_accounts') return [];
        return null;
      });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('yes');
    });

    expect(screen.getByTestId('address')).toHaveTextContent(testAddress);
  });

  it('switches to Base network if on wrong chain', async () => {
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

  it('shows shortened address when connected', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';
    
    mockEthereum.request
      .mockReset()
      .mockImplementation(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [testAddress];
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_accounts') return [];
        return null;
      });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Connect Wallet'));

    // Should show shortened address like "0x1234...7890"
    const addressButton = await screen.findByText('0x1234...7890', {}, { timeout: 3000 });
    expect(addressButton).toBeInTheDocument();
  });

  it('opens dropdown menu when connected and clicked', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890';
    
    // Reset and setup mocks fresh for this test
    mockEthereum.request
      .mockReset()
      .mockImplementation(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [testAddress];
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_accounts') return [];
        return null;
      });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // Wait a bit for useEffect to run
    await waitFor(() => {
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Connect Wallet'));

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
    
    // Setup mocks
    mockEthereum.request
      .mockReset()
      .mockImplementation(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [testAddress];
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_accounts') return [];
        return null;
      });

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

    fireEvent.click(screen.getByText('Connect Wallet'));
    
    const addressButton = await screen.findByText('0x1234...7890', {}, { timeout: 3000 });
    fireEvent.click(addressButton);
    
    const copyButton = await screen.findByText('Copy Address');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testAddress);
    });
  });
});

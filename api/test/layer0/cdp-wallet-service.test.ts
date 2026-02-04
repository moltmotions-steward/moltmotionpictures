/**
 * Layer 0 - CDPWalletService Unit Tests
 * 
 * Tests for CDP wallet creation service with mocked CDP SDK.
 * Validates:
 * - Service exports and configuration checks
 * - Idempotency key generation
 * - Address validation
 * - Explorer URL generation
 * - Error handling for missing credentials
 * 
 * These are pure unit tests - no network calls, no real CDP.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the CDP SDK before importing the service
vi.mock('@coinbase/cdp-sdk', () => {
  const mockCreateAccount = vi.fn();
  return {
    CdpClient: vi.fn().mockImplementation(() => ({
      evm: {
        createAccount: mockCreateAccount,
      },
    })),
    __mockCreateAccount: mockCreateAccount,
  };
});

// Mock config to control credentials in tests
vi.mock('../../src/config/index.js', () => ({
  default: {
    nodeEnv: 'test',
    cdp: {
      apiKeyName: 'test-api-key-name',
      apiKeySecret: 'test-api-key-secret',
      walletSecret: 'test-wallet-secret',
    },
  },
}));

// Import after mocks are set up
import * as CDPWalletService from '../../src/services/CDPWalletService';
import { CdpClient } from '@coinbase/cdp-sdk';

describe('Layer 0 - CDPWalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Exports', () => {
    it('exports createWalletForAgent function', () => {
      expect(typeof CDPWalletService.createWalletForAgent).toBe('function');
    });

    it('exports getExplorerUrl function', () => {
      expect(typeof CDPWalletService.getExplorerUrl).toBe('function');
    });

    it('exports isValidAddress function', () => {
      expect(typeof CDPWalletService.isValidAddress).toBe('function');
    });

    it('exports isConfigured function', () => {
      expect(typeof CDPWalletService.isConfigured).toBe('function');
    });

    it('exports getNetworkInfo function', () => {
      expect(typeof CDPWalletService.getNetworkInfo).toBe('function');
    });
  });

  describe('isValidAddress', () => {
    it('returns true for valid Ethereum addresses', () => {
      expect(CDPWalletService.isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(CDPWalletService.isValidAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
      expect(CDPWalletService.isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('returns false for invalid addresses', () => {
      expect(CDPWalletService.isValidAddress('')).toBe(false);
      expect(CDPWalletService.isValidAddress('not-an-address')).toBe(false);
      expect(CDPWalletService.isValidAddress('0x123')).toBe(false); // Too short
      expect(CDPWalletService.isValidAddress('0x1234567890abcdef1234567890abcdef123456789')).toBe(false); // Too long
      expect(CDPWalletService.isValidAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false); // Missing 0x
      expect(CDPWalletService.isValidAddress('0xGGGG567890abcdef1234567890abcdef12345678')).toBe(false); // Invalid hex
    });
  });

  describe('getExplorerUrl', () => {
    it('generates correct BaseScan URL for testnet', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const url = CDPWalletService.getExplorerUrl(address);
      
      // In test mode (non-production), should use sepolia
      expect(url).toContain(address);
      expect(url).toMatch(/^https:\/\/(sepolia\.)?basescan\.org\/address\//);
    });

    it('includes the full address in URL', () => {
      const address = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const url = CDPWalletService.getExplorerUrl(address);
      expect(url).toContain(address);
    });
  });

  describe('getNetworkInfo', () => {
    it('returns network configuration object', () => {
      const info = CDPWalletService.getNetworkInfo();
      
      expect(info).toHaveProperty('network');
      expect(info).toHaveProperty('isProduction');
      expect(info).toHaveProperty('explorerBaseUrl');
    });

    it('returns base-sepolia in test mode', () => {
      const info = CDPWalletService.getNetworkInfo();
      
      // Test environment should use testnet
      expect(info.network).toBe('base-sepolia');
      expect(info.isProduction).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('returns true when all CDP credentials are set', () => {
      // With our mock config, all credentials are set
      expect(CDPWalletService.isConfigured()).toBe(true);
    });
  });

  describe('WalletCreationResult interface', () => {
    it('createWalletForAgent returns expected shape', async () => {
      // Get the mock from the module
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      // Mock successful response
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0xTestAddress1234567890ABCDEF1234567890ABCDEF',
      });

      const result = await CDPWalletService.createWalletForAgent('test-agent-123');

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('network');
      expect(result).toHaveProperty('explorerUrl');
      expect(result).toHaveProperty('isNew');
    });
  });

  describe('Idempotency Key Generation', () => {
    it('uses agent ID in idempotency key', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      await CDPWalletService.createWalletForAgent('my-unique-agent');

      // Verify createAccount was called with idempotency key containing agent ID
      expect(__mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.stringContaining('my-unique-agent'),
        })
      );
    });

    it('prepends molt-agent- prefix to idempotency key', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      await CDPWalletService.createWalletForAgent('agent-xyz');

      expect(__mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'molt-agent-agent-xyz',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('throws descriptive error when CDP call fails', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockRejectedValueOnce(new Error('CDP API rate limited'));

      await expect(
        CDPWalletService.createWalletForAgent('failing-agent')
      ).rejects.toThrow('Failed to create wallet');
    });

    it('includes original error message in thrown error', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        CDPWalletService.createWalletForAgent('failing-agent')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Wallet Creation Response', () => {
    it('returns correct address from CDP response', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      const expectedAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      
      __mockCreateAccount.mockResolvedValueOnce({
        address: expectedAddress,
      });

      const result = await CDPWalletService.createWalletForAgent('test-agent');

      expect(result.address).toBe(expectedAddress);
    });

    it('includes explorer URL in response', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      
      __mockCreateAccount.mockResolvedValueOnce({ address });

      const result = await CDPWalletService.createWalletForAgent('test-agent');

      expect(result.explorerUrl).toContain(address);
      expect(result.explorerUrl).toMatch(/basescan\.org/);
    });

    it('includes network in response', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const result = await CDPWalletService.createWalletForAgent('test-agent');

      expect(result.network).toBe('base-sepolia');
    });
  });
});

describe('Layer 0 - CDPWalletService Edge Cases', () => {
  describe('Agent ID Validation', () => {
    it('handles empty agent ID', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      // Should still work with empty string (API layer validates)
      const result = await CDPWalletService.createWalletForAgent('');
      expect(result.address).toBeDefined();
    });

    it('handles UUID-format agent IDs', async () => {
      const { __mockCreateAccount } = await import('@coinbase/cdp-sdk') as any;
      
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const result = await CDPWalletService.createWalletForAgent(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      );
      
      expect(result.address).toBeDefined();
      expect(__mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'molt-agent-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        })
      );
    });
  });
});

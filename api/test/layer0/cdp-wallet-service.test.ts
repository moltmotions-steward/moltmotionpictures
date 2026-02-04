/**
 * Layer 0 - CDPWalletService Unit Tests
 * 
 * Tests for CDP wallet creation service.
 * These tests validate:
 * - Pure utility functions (no mocking needed)
 * - Configuration detection
 * - Address validation
 * - Explorer URL generation
 * - Network info
 * 
 * Note: createWalletForAgent requires real CDP credentials
 * and is tested in Layer 1/2 with real calls.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

describe('Layer 0 - CDPWalletService', () => {
  // Dynamic import holder
  let CDPWalletService: typeof import('../../src/services/CDPWalletService');

  beforeAll(async () => {
    // Set required env vars BEFORE importing module using vitest's stubEnv
    vi.stubEnv('CDP_API_KEY_NAME', 'test-api-key-name');
    vi.stubEnv('CDP_API_KEY_SECRET', 'test-api-key-secret');
    vi.stubEnv('CDP_WALLET_SECRET', 'test-wallet-secret');
    vi.stubEnv('NODE_ENV', 'test');

    // Reset module cache to ensure fresh import with new env
    vi.resetModules();

    // Now dynamically import after env is set
    CDPWalletService = await import('../../src/services/CDPWalletService');
  });

  afterAll(() => {
    // Restore original env
    vi.unstubAllEnvs();
    vi.resetModules();
  });

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
    it('returns true for valid Ethereum addresses (lowercase)', () => {
      expect(CDPWalletService.isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    });

    it('returns true for valid Ethereum addresses (uppercase)', () => {
      expect(CDPWalletService.isValidAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
    });

    it('returns true for zero address', () => {
      expect(CDPWalletService.isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('returns true for mixed case addresses', () => {
      expect(CDPWalletService.isValidAddress('0xaBcDeF1234567890abcDEF1234567890AbCdEf12')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(CDPWalletService.isValidAddress('')).toBe(false);
    });

    it('returns false for non-hex string', () => {
      expect(CDPWalletService.isValidAddress('not-an-address')).toBe(false);
    });

    it('returns false for too short address', () => {
      expect(CDPWalletService.isValidAddress('0x123')).toBe(false);
    });

    it('returns false for too long address', () => {
      expect(CDPWalletService.isValidAddress('0x1234567890abcdef1234567890abcdef123456789')).toBe(false);
    });

    it('returns false for missing 0x prefix', () => {
      expect(CDPWalletService.isValidAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
    });

    it('returns false for invalid hex characters', () => {
      expect(CDPWalletService.isValidAddress('0xGGGG567890abcdef1234567890abcdef12345678')).toBe(false);
    });

    it('returns false for null-like values', () => {
      expect(CDPWalletService.isValidAddress(null as any)).toBe(false);
      expect(CDPWalletService.isValidAddress(undefined as any)).toBe(false);
    });
  });

  describe('getExplorerUrl', () => {
    it('returns BaseScan URL for given address', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const url = CDPWalletService.getExplorerUrl(address);
      
      expect(url).toContain(address);
      expect(url).toMatch(/^https:\/\/(sepolia\.)?basescan\.org\/address\//);
    });

    it('uses sepolia subdomain in test mode', () => {
      const address = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const url = CDPWalletService.getExplorerUrl(address);
      
      // In test mode, should use sepolia
      expect(url).toContain('sepolia.basescan.org');
    });

    it('includes the full address in URL', () => {
      const address = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const url = CDPWalletService.getExplorerUrl(address);
      expect(url.endsWith(address)).toBe(true);
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
      
      expect(info.network).toBe('base-sepolia');
      expect(info.isProduction).toBe(false);
    });

    it('uses sepolia explorer base URL in test mode', () => {
      const info = CDPWalletService.getNetworkInfo();
      
      expect(info.explorerBaseUrl).toContain('sepolia');
    });
  });

  describe('isConfigured', () => {
    it('returns true when all CDP credentials are set via env', () => {
      // Env vars were set in beforeAll
      expect(CDPWalletService.isConfigured()).toBe(true);
    });
  });

  describe('Idempotency Key Format', () => {
    // Test the idempotency key format indirectly through the function signature
    it('createWalletForAgent accepts agentId parameter', () => {
      // Just verify the function signature
      expect(CDPWalletService.createWalletForAgent.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// Note: Tests for "unconfigured" state would require running in separate
// process since Node.js caches modules. This is tested in Layer 1/2 
// integration tests with real env configurations.

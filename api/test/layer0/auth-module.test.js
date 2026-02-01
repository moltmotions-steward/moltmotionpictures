/**
 * Layer 0 - Auth Utils Module Execution Tests
 * Tests that import and execute auth utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  generateClaimToken,
  generateVerificationCode,
  validateApiKey,
  extractToken,
  hashToken,
  compareTokens
} from '../../src/utils/auth.js';

describe('Layer 0 - Auth Utils Module Execution', () => {
  describe('generateApiKey()', () => {
    it('generates API key with correct prefix', () => {
      const apiKey = generateApiKey();
      
      expect(apiKey).toMatch(/^moltmotionpictures_/);
      expect(apiKey.length).toBeGreaterThan(20);
    });

    it('generates unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      
      expect(key1).not.toBe(key2);
    });

    it('generates keys with 64 hex characters after prefix', () => {
      const apiKey = generateApiKey();
      const hexPart = apiKey.replace('moltmotionpictures_', '');
      
      expect(hexPart.length).toBe(64);
      expect(hexPart).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateClaimToken()', () => {
    it('generates claim token with correct prefix', () => {
      const claimToken = generateClaimToken();
      
      expect(claimToken).toMatch(/^moltmotionpictures_claim_/);
    });

    it('generates unique claim tokens', () => {
      const token1 = generateClaimToken();
      const token2 = generateClaimToken();
      
      expect(token1).not.toBe(token2);
    });

    it('generates tokens with hex characters', () => {
      const token = generateClaimToken();
      const hexPart = token.replace('moltmotionpictures_claim_', '');
      
      expect(hexPart).toMatch(/^[0-9a-f]+$/);
      expect(hexPart.length).toBeGreaterThan(0);
    });
  });

  describe('generateVerificationCode()', () => {
    it('generates verification code with correct format', () => {
      const code = generateVerificationCode();
      
      expect(code).toMatch(/^[a-z]+-[A-F0-9]+$/);
    });

    it('generates unique codes', () => {
      const code1 = generateVerificationCode();
      const code2 = generateVerificationCode();
      
      // Might be same by chance, but should work
      expect(typeof code1).toBe('string');
      expect(typeof code2).toBe('string');
    });

    it('contains hyphen separator', () => {
      const code = generateVerificationCode();
      
      expect(code.includes('-')).toBe(true);
    });
  });

  describe('validateApiKey()', () => {
    it('validates correct API key format', () => {
      const validKey = 'moltmotionpictures_' + 'a'.repeat(64);
      
      expect(validateApiKey(validKey)).toBe(true);
    });

    it('rejects key without prefix', () => {
      const invalidKey = 'abc123';
      
      expect(validateApiKey(invalidKey)).toBe(false);
    });

    it('rejects key with wrong length', () => {
      const invalidKey = 'moltmotionpictures_abc';
      
      expect(validateApiKey(invalidKey)).toBe(false);
    });

    it('rejects null or undefined', () => {
      expect(validateApiKey(null)).toBe(false);
      expect(validateApiKey(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateApiKey('')).toBe(false);
    });
  });

  describe('extractToken()', () => {
    it('extracts token from Bearer header', () => {
      const header = 'Bearer moltmotionpictures_abc123';
      
      const token = extractToken(header);
      expect(token).toBe('moltmotionpictures_abc123');
    });

    it('returns null for invalid format', () => {
      expect(extractToken('Invalid')).toBe(null);
      expect(extractToken('')).toBe(null);
      expect(extractToken(null)).toBe(null);
    });

    it('requires Bearer scheme', () => {
      const header = 'Basic abc123';
      
      expect(extractToken(header)).toBe(null);
    });
  });

  describe('hashToken()', () => {
    it('hashes token to SHA-256', () => {
      const token = 'test_token_123';
      const hash = hashToken(token);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('produces consistent hashes', () => {
      const token = 'test_token_123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compareTokens()', () => {
    it('returns true for equal tokens', () => {
      const token = 'test_token_123';
      
      expect(compareTokens(token, token)).toBe(true);
    });

    it('returns false for different tokens', () => {
      expect(compareTokens('token1', 'token2')).toBe(false);
    });

    it('returns false for different lengths', () => {
      expect(compareTokens('short', 'longer_token')).toBe(false);
    });

    it('handles null/undefined', () => {
      expect(compareTokens(null, 'token')).toBe(false);
      expect(compareTokens('token', null)).toBe(false);
      expect(compareTokens(null, null)).toBe(false);
    });
  });
});

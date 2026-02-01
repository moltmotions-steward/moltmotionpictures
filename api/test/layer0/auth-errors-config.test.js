/**
 * Layer 0 - Pure Logic Tests
 * Auth utilities, error classes, config
 */

import { describe, it, expect } from 'vitest';
import { 
  generateApiKey, 
  generateClaimToken, 
  generateVerificationCode,
  validateApiKey,
  extractToken,
  hashToken
} from '../../src/utils/auth.js';
import {
  ApiError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../../src/utils/errors.js';

describe('Auth Utils', () => {
  it('generateApiKey creates valid key', () => {
    const key = generateApiKey();
    expect(key.startsWith('moltmotionpictures_')).toBe(true);
    expect(key.length).toBe(83); // prefix (19) + hex (64)
  });

  it('generateClaimToken creates valid token', () => {
    const token = generateClaimToken();
    expect(token.startsWith('moltmotionpictures_claim_')).toBe(true);
  });

  it('generateVerificationCode has correct format', () => {
    const code = generateVerificationCode();
    expect(/^[a-z]+-[A-F0-9]{4}$/.test(code)).toBe(true);
  });

  it('validateApiKey accepts valid key', () => {
    const key = generateApiKey();
    expect(validateApiKey(key)).toBe(true);
  });

  it('validateApiKey rejects invalid key', () => {
    expect(validateApiKey('invalid')).toBe(false);
    expect(validateApiKey(null)).toBe(false);
    expect(validateApiKey('moltmotionpictures_short')).toBe(false);
  });

  it('extractToken extracts from Bearer header', () => {
    const token = extractToken('Bearer moltmotionpictures_test123');
    expect(token).toBe('moltmotionpictures_test123');
  });

  it('extractToken returns null for invalid header', () => {
    expect(extractToken('Basic abc')).toBe(null);
    expect(extractToken('Bearer')).toBe(null);
    expect(extractToken(null)).toBe(null);
  });

  it('hashToken creates consistent hash', () => {
    const hash1 = hashToken('test');
    const hash2 = hashToken('test');
    expect(hash1).toBe(hash2);
  });
});

describe('Error Classes', () => {
  it('ApiError creates with status code', () => {
    const error = new ApiError('Test', 400);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Test');
  });

  it('BadRequestError has status 400', () => {
    const error = new BadRequestError('Bad input');
    expect(error.statusCode).toBe(400);
  });

  it('NotFoundError has status 404', () => {
    const error = new NotFoundError('User');
    expect(error.statusCode).toBe(404);
    expect(error.message.includes('not found')).toBe(true);
  });

  it('UnauthorizedError has status 401', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
  });

  it('ApiError toJSON returns correct format', () => {
    const error = new ApiError('Test', 400, 'TEST_CODE', 'Fix it');
    const json = error.toJSON();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Test');
    expect(json.code).toBe('TEST_CODE');
    expect(json.hint).toBe('Fix it');
  });
});

describe('Config', () => {
  it('config loads without error', async () => {
    const { default: config } = await import('../../src/config/index.js');
    expect(config.port).toBeDefined();
    expect(config.moltmotionpictures.tokenPrefix).toBeDefined();
  });
});

/**
 * Authentication utilities (TypeScript)
 */

import { createHash, randomBytes } from 'crypto';
import config from '../config';

const { tokenPrefix, claimPrefix } = config.moltmotionpictures;
const TOKEN_LENGTH = 32;

// Word list for verification codes
const ADJECTIVES: readonly string[] = [
  'reef', 'wave', 'coral', 'shell', 'tide', 'kelp', 'foam', 'salt',
  'deep', 'blue', 'aqua', 'pearl', 'sand', 'surf', 'cove', 'bay'
] as const;

/**
 * Generate a secure random hex string
 */
export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  return `${tokenPrefix}${randomHex(TOKEN_LENGTH)}`;
}

/**
 * Generate a claim token
 */
export function generateClaimToken(): string {
  return `${claimPrefix}${randomHex(TOKEN_LENGTH)}`;
}

/**
 * Generate human-readable verification code
 */
export function generateVerificationCode(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const suffix = randomHex(2).toUpperCase();
  return `${adjective}-${suffix}`;
}

/**
 * Validate API key format
 */
export function validateApiKey(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith(tokenPrefix)) return false;

  const expectedLength = tokenPrefix.length + (TOKEN_LENGTH * 2);
  if (token.length !== expectedLength) return false;

  const body = token.slice(tokenPrefix.length);
  return /^[0-9a-f]+$/i.test(body);
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer') return null;

  return token;
}

/**
 * Hash a token for secure storage
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token matches a hash
 */
export function verifyToken(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}

// Default export for CommonJS compatibility
export default {
  randomHex,
  generateApiKey,
  generateClaimToken,
  generateVerificationCode,
  validateApiKey,
  extractToken,
  hashToken,
  verifyToken
};

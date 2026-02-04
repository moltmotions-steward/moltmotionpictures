import { describe, it, expect } from 'vitest';
import { generateClaimToken, hashToken, verifyToken } from '../../src/utils/auth';
import config from '../../src/config/index.js';

describe('Claim Security Logic', () => {
  it('correctly distinguishes between legacy and hashed tokens', () => {
    const plainToken = generateClaimToken();
    const hashedToken = hashToken(plainToken);
    const prefix = config.moltmotionpictures.claimPrefix;

    // Legacy (plain) token should start with prefix
    expect(plainToken.startsWith(prefix)).toBe(true);

    // Hashed token should NOT start with prefix
    // SHA-256 hex string is random, highly unlikely to start with 'moltmotionpictures_claim_'
    expect(hashedToken.startsWith(prefix)).toBe(false);
  });

  it('verifies hashed tokens correctly', () => {
    const plainToken = generateClaimToken();
    const hashedToken = hashToken(plainToken);

    // Verify correct token
    expect(verifyToken(plainToken, hashedToken)).toBe(true);

    // Verify incorrect token
    expect(verifyToken('wrong_token', hashedToken)).toBe(false);
  });

  it('verifies logic flow for claim route', () => {
    const plainToken = generateClaimToken();
    const hashedToken = hashToken(plainToken);
    const prefix = config.moltmotionpictures.claimPrefix;

    // Simulation of the logic in claim.ts
    const verifyLogic = (storedToken: string, inputToken: string) => {
      const isLegacyToken = storedToken.startsWith(prefix);
      if (isLegacyToken) {
        return storedToken === inputToken;
      } else {
        return verifyToken(inputToken, storedToken);
      }
    };

    // Case 1: New Agent (Hashed Token in DB)
    expect(verifyLogic(hashedToken, plainToken)).toBe(true);
    expect(verifyLogic(hashedToken, 'wrong')).toBe(false);

    // Case 2: Legacy Agent (Plain Token in DB)
    expect(verifyLogic(plainToken, plainToken)).toBe(true);
    expect(verifyLogic(plainToken, 'wrong')).toBe(false);
  });
});

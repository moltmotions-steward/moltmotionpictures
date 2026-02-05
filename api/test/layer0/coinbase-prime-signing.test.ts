import { describe, it, expect } from 'vitest';

describe('CoinbasePrimeClient signing', () => {
  it('is intentionally removed with Coinbase Prime routes', async () => {
    // Coinbase Prime-backed staking/signing code was removed from the API surface.
    // This test now guards against accidental re-introduction without explicit work.
    await expect(import('../../src/services/CoinbasePrimeClient.js')).rejects.toBeDefined();
  });
});

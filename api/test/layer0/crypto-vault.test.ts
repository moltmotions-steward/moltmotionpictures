import { describe, it, expect } from 'vitest';
import { decryptString, encryptString } from '../../src/utils/cryptoVault.js';

describe('cryptoVault', () => {
  it('round-trips strings', () => {
    const key = Buffer.alloc(32, 7);
    const plaintext = 'hello vault';
    const enc = encryptString(plaintext, key);
    const dec = decryptString(enc, key);
    expect(dec).toBe(plaintext);
  });

  it('rejects wrong key', () => {
    const key1 = Buffer.alloc(32, 1);
    const key2 = Buffer.alloc(32, 2);
    const enc = encryptString('secret', key1);
    expect(() => decryptString(enc, key2)).toThrow();
  });
});


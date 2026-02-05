import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { signPrimeRequest } from '../../src/services/CoinbasePrimeClient.js';

describe('CoinbasePrimeClient signing', () => {
  it('matches HMAC-SHA256(base64decodedKey, ts+method+path+body) base64', () => {
    const signingKeyRaw = Buffer.from('super-secret-key-bytes');
    const signingKeyB64 = signingKeyRaw.toString('base64');

    const timestampSeconds = '1700000000';
    const method = 'POST';
    const requestPathWithQuery = '/v1/portfolios/abc/wallets/def/staking/initiate?foo=bar';
    const body = JSON.stringify({ hello: 'world' });

    const expected = crypto
      .createHmac('sha256', signingKeyRaw)
      .update(`${timestampSeconds}${method}${requestPathWithQuery}${body}`)
      .digest('base64');

    const actual = signPrimeRequest({
      timestampSeconds,
      method,
      requestPathWithQuery,
      body,
      signingKey: signingKeyB64,
    });

    expect(actual).toBe(expected);
  });
});


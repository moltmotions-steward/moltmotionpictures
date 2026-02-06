import { describe, it, expect } from 'vitest';
import { buildSeriesTipPaymentRequiredResponse } from '../../src/services/X402Service';

describe('X402Service - series tip 402 response', () => {
  it('returns a 402 response with series_id in payment_details', () => {
    const res = buildSeriesTipPaymentRequiredResponse(25, 'https://example.test/api/v1/series/abc/tip', 'series_abc', 'Tip series');
    expect(res.x402Version).toBe(2);
    expect(res.accepts?.length).toBe(1);
    expect(res.payment_details.series_id).toBe('series_abc');
    expect(res.payment_details.amount_cents).toBe(25);
  });
});


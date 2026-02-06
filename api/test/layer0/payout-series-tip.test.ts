import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
  $transaction: vi.fn(),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/config/index.js', () => ({
  default: {
    revenueSplit: {
      creatorPercent: 80,
      platformPercent: 19,
      agentPercent: 1,
    },
    payouts: {
      unclaimedExpiryDays: 30,
    },
    x402: {
      platformWallet: '0x9999999999999999999999999999999999999999',
    },
  },
}));

import { processSeriesTipPayouts } from '../../src/services/PayoutService';

describe('PayoutService - processSeriesTipPayouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed when agent wallet is missing', async () => {
    const result = await processSeriesTipPayouts(
      'series_tip_1',
      125,
      'agent_1',
      '0x1111111111111111111111111111111111111111',
      null
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Agent wallet not configured/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates creator/platform/agent payouts for series tip', async () => {
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payout: {
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: 'p_creator' })
            .mockResolvedValueOnce({ id: 'p_platform' })
            .mockResolvedValueOnce({ id: 'p_agent' }),
        },
        unclaimedFund: { create: vi.fn() },
        agent: { update: vi.fn().mockResolvedValue({ id: 'agent_1' }) },
      };
      return cb(tx);
    });

    const result = await processSeriesTipPayouts(
      'series_tip_2',
      100,
      'agent_1',
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222'
    );

    expect(result.success).toBe(true);
    expect(result.payoutIds).toEqual(['p_creator', 'p_platform', 'p_agent']);
    expect(result.splits).toHaveLength(3);
    expect(result.splits.reduce((sum, s) => sum + s.amountCents, 0)).toBe(100);
  });
});

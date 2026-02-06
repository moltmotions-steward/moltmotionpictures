import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, metricsMock } = vi.hoisted(() => ({
  prismaMock: {
    refund: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    clipVote: {
      update: vi.fn(),
    },
    seriesTip: {
      update: vi.fn(),
    },
  },
  metricsMock: {
    recordRefundCreated: vi.fn(),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/services/PaymentMetrics.js', () => metricsMock);

vi.mock('../../src/config/index.js', () => ({
  default: {
    nodeEnv: 'test',
    x402: {
      platformWallet: '0x9999999999999999999999999999999999999999',
    },
  },
}));

import { createRefundRequest } from '../../src/services/RefundService';

describe('RefundService - series tip refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires exactly one payment reference', async () => {
    const missing = await createRefundRequest({
      payerAddress: '0x1111111111111111111111111111111111111111',
      amountCents: 25,
      originalTxHash: '0xabc',
      reason: 'test',
    });
    expect(missing.success).toBe(false);

    const both = await createRefundRequest({
      clipVoteId: 'clip_1',
      seriesTipId: 'tip_1',
      payerAddress: '0x1111111111111111111111111111111111111111',
      amountCents: 25,
      originalTxHash: '0xabc',
      reason: 'test',
    });
    expect(both.success).toBe(false);
  });

  it('creates refund and updates series tip payment status', async () => {
    prismaMock.refund.findFirst.mockResolvedValue(null);
    prismaMock.refund.create.mockResolvedValue({ id: 'refund_1' });
    prismaMock.seriesTip.update.mockResolvedValue({ id: 'tip_1' });

    const result = await createRefundRequest({
      seriesTipId: 'tip_1',
      payerAddress: '0x1111111111111111111111111111111111111111',
      amountCents: 125,
      originalTxHash: '0xabc',
      reason: 'payout failed',
    });

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('refund_1');
    expect(prismaMock.refund.create).toHaveBeenCalled();
    expect(prismaMock.seriesTip.update).toHaveBeenCalledWith({
      where: { id: 'tip_1' },
      data: { payment_status: 'refund_pending' },
    });
    expect(metricsMock.recordRefundCreated).toHaveBeenCalledWith(125);
  });
});

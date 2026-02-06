import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refundMock, metricsMock, prismaMock } = vi.hoisted(() => ({
  refundMock: {
    createRefundRequest: vi.fn().mockResolvedValue({ success: true, refundId: 'refund_1' }),
  },
  metricsMock: {
    recordPayoutCompleted: vi.fn(),
    recordPayoutFailed: vi.fn(),
  },
  prismaMock: {
    payout: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    seriesTip: {
      findUnique: vi.fn(),
    },
    clipVote: {
      findUnique: vi.fn(),
    },
    agent: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/services/RefundService.js', () => refundMock);
vi.mock('../../src/services/PaymentMetrics.js', () => metricsMock);

vi.mock('../../src/config/index.js', () => ({
  default: {
    nodeEnv: 'test',
    x402: {
      platformWallet: '0x9999999999999999999999999999999999999999',
    },
  },
}));

import { processPayouts } from '../../src/services/PayoutProcessor';

describe('PayoutProcessor - series tip refund trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_WALLET_PRIVATE_KEY = '0x1234';
  });

  it('creates series-tip refund when creator payout permanently fails', async () => {
    const payout = {
      id: 'payout_1',
      wallet_address: '0x1111111111111111111111111111111111111111',
      amount_cents: 125,
      recipient_type: 'creator',
      source_agent_id: 'agent_1',
      retry_count: 4,
      created_at: new Date(),
      updated_at: new Date(),
      status: 'pending',
    };

    prismaMock.payout.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === 'failed') return [];
      if (args?.where?.status === 'pending') return [payout];
      return [];
    });

    prismaMock.payout.findUnique.mockResolvedValue({ id: 'payout_1', series_tip_id: 'tip_1' });
    prismaMock.seriesTip.findUnique.mockResolvedValue({
      id: 'tip_1',
      payer_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tip_amount_cents: 125,
      payment_tx_hash: '0xdeadbeef',
    });

    const result = await processPayouts();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(refundMock.createRefundRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesTipId: 'tip_1',
        amountCents: 125,
      })
    );
  });
});

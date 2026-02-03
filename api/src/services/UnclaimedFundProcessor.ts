/**
 * UnclaimedFundProcessor
 *
 * Sweeps expired unclaimed funds (e.g. missing creator wallet) to the platform treasury.
 * This is designed to run as a cron job (daily is sufficient).
 */

import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

const prisma = new PrismaClient();

export interface UnclaimedSweepStats {
  scanned: number;
  sweptMarked: number;
  payoutsCreated: number;
  treasuryWallet: string;
  errors: string[];
}

export async function sweepExpiredUnclaimedFunds(limit = 500): Promise<UnclaimedSweepStats> {
  const treasuryWallet = config.payouts.treasuryWallet;

  if (!treasuryWallet) {
    return {
      scanned: 0,
      sweptMarked: 0,
      payoutsCreated: 0,
      treasuryWallet: '',
      errors: ['Treasury wallet not configured (TREASURY_WALLET_ADDRESS or PLATFORM_WALLET_ADDRESS)']
    };
  }

  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const funds = await tx.unclaimedFund.findMany({
        where: {
          claimed_at: null,
          swept_to_treasury_at: null,
          expires_at: { lte: now }
        },
        orderBy: { expires_at: 'asc' },
        take: limit
      });

      if (funds.length === 0) {
        return {
          scanned: 0,
          sweptMarked: 0,
          payoutsCreated: 0,
          treasuryWallet,
          errors: []
        };
      }

      // Create idempotent treasury payouts (unique on [clip_vote_id, recipient_type])
      // We use recipient_type='treasury' to avoid colliding with the existing 'platform' payout.
      const createResult = await tx.payout.createMany({
        data: funds.map((f) => ({
          recipient_type: 'treasury',
          wallet_address: treasuryWallet,
          source_agent_id: f.source_agent_id,
          recipient_agent_id: null,
          clip_vote_id: f.clip_vote_id,
          amount_cents: f.amount_cents,
          split_percent: f.split_percent,
          status: 'pending'
        })),
        skipDuplicates: true
      });

      const updateResult = await tx.unclaimedFund.updateMany({
        where: { id: { in: funds.map((f) => f.id) } },
        data: { swept_to_treasury_at: now }
      });

      return {
        scanned: funds.length,
        sweptMarked: updateResult.count,
        payoutsCreated: createResult.count,
        treasuryWallet,
        errors: []
      };
    });
  } catch (error) {
    return {
      scanned: 0,
      sweptMarked: 0,
      payoutsCreated: 0,
      treasuryWallet,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

export default {
  sweepExpiredUnclaimedFunds
};

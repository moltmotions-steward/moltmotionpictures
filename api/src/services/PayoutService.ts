/**
 * PayoutService - Handles revenue splits for clip voting tips
 * 
 * Split: 69% Creator / 30% Platform / 1% Agent
 * 
 * The agent that wrote the winning script gets 1% - because why not?
 * The agent did the work. The human just voted.
 */
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

const prisma = new PrismaClient();

export type RecipientType = 'creator' | 'agent' | 'platform';

export interface PayoutSplit {
  recipientType: RecipientType;
  walletAddress: string;
  amountCents: number;
  splitPercent: number;
}

export interface TipProcessingResult {
  success: boolean;
  clipVoteId: string;
  totalTipCents: number;
  splits: PayoutSplit[];
  payoutIds: string[];
  error?: string;
}

/**
 * Calculate the revenue splits for a tip
 * @param totalCents - Total tip amount in cents
 * @returns Array of splits with amounts
 */
export function calculateSplits(totalCents: number): { creator: number; platform: number; agent: number } {
  const { creatorPercent, platformPercent, agentPercent } = config.revenueSplit;
  
  // Calculate each split (floor to avoid fractional cents)
  const agentAmount = Math.floor((totalCents * agentPercent) / 100);
  const platformAmount = Math.floor((totalCents * platformPercent) / 100);
  // Creator gets the remainder to ensure no dust is lost
  const creatorAmount = totalCents - platformAmount - agentAmount;
  
  return {
    creator: creatorAmount,
    platform: platformAmount,
    agent: agentAmount
  };
}

/**
 * Process a tip and create payout records for all parties
 * 
 * @param clipVoteId - The ClipVote record with the tip
 * @param tipAmountCents - Total tip amount
 * @param sourceAgentId - The agent that authored the winning content
 * @param creatorWalletAddress - Creator's wallet (user who owns the agent)
 * @param agentWalletAddress - Agent's own wallet (if set)
 * @returns Processing result with payout IDs
 */
export async function processTipPayouts(
  clipVoteId: string,
  tipAmountCents: number,
  sourceAgentId: string,
  creatorWalletAddress: string | null,
  agentWalletAddress: string | null
): Promise<TipProcessingResult> {
  const splits = calculateSplits(tipAmountCents);
  const payouts: PayoutSplit[] = [];
  const payoutIds: string[] = [];
  
  const platformWallet = config.x402.platformWallet;
  
  if (!platformWallet) {
    return {
      success: false,
      clipVoteId,
      totalTipCents: tipAmountCents,
      splits: [],
      payoutIds: [],
      error: 'Platform wallet not configured'
    };
  }
  
  try {
    // Use a transaction to create all payouts atomically
    const result = await prisma.$transaction(async (tx) => {
      const createdPayouts: string[] = [];
      
      // 1. Creator payout (69%)
      if (creatorWalletAddress && splits.creator > 0) {
        const creatorPayout = await tx.payout.create({
          data: {
            recipient_type: 'creator',
            wallet_address: creatorWalletAddress,
            source_agent_id: sourceAgentId,
            recipient_agent_id: sourceAgentId, // Creator owns this agent
            clip_vote_id: clipVoteId,
            amount_cents: splits.creator,
            split_percent: config.revenueSplit.creatorPercent,
            status: 'pending'
          }
        });
        createdPayouts.push(creatorPayout.id);
        payouts.push({
          recipientType: 'creator',
          walletAddress: creatorWalletAddress,
          amountCents: splits.creator,
          splitPercent: config.revenueSplit.creatorPercent
        });
      }
      
      // 2. Platform payout (30%)
      if (splits.platform > 0) {
        const platformPayout = await tx.payout.create({
          data: {
            recipient_type: 'platform',
            wallet_address: platformWallet,
            source_agent_id: sourceAgentId,
            recipient_agent_id: null,
            clip_vote_id: clipVoteId,
            amount_cents: splits.platform,
            split_percent: config.revenueSplit.platformPercent,
            status: 'pending'
          }
        });
        createdPayouts.push(platformPayout.id);
        payouts.push({
          recipientType: 'platform',
          walletAddress: platformWallet,
          amountCents: splits.platform,
          splitPercent: config.revenueSplit.platformPercent
        });
      }
      
      // 3. Agent payout (1%) - The AI gets paid!
      if (agentWalletAddress && splits.agent > 0) {
        const agentPayout = await tx.payout.create({
          data: {
            recipient_type: 'agent',
            wallet_address: agentWalletAddress,
            source_agent_id: sourceAgentId,
            recipient_agent_id: sourceAgentId, // Agent pays itself
            clip_vote_id: clipVoteId,
            amount_cents: splits.agent,
            split_percent: config.revenueSplit.agentPercent,
            status: 'pending'
          }
        });
        createdPayouts.push(agentPayout.id);
        payouts.push({
          recipientType: 'agent',
          walletAddress: agentWalletAddress,
          amountCents: splits.agent,
          splitPercent: config.revenueSplit.agentPercent
        });
      }
      
      // Update agent's earnings counters
      const totalAgentEarnings = splits.creator + splits.agent; // Creator + agent share both go to "agent's" account
      await tx.agent.update({
        where: { id: sourceAgentId },
        data: {
          pending_payout_cents: { increment: totalAgentEarnings },
          total_earned_cents: { increment: totalAgentEarnings }
        }
      });
      
      return createdPayouts;
    });
    
    return {
      success: true,
      clipVoteId,
      totalTipCents: tipAmountCents,
      splits: payouts,
      payoutIds: result
    };
  } catch (error) {
    return {
      success: false,
      clipVoteId,
      totalTipCents: tipAmountCents,
      splits: [],
      payoutIds: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get pending payouts for processing
 * @param limit - Maximum number of payouts to retrieve
 */
export async function getPendingPayouts(limit = 100) {
  return prisma.payout.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'asc' },
    take: limit
  });
}

/**
 * Mark a payout as completed after successful transfer
 */
export async function completePayout(payoutId: string, txHash: string) {
  return prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'completed',
      tx_hash: txHash,
      completed_at: new Date()
    }
  });
}

/**
 * Mark a payout as failed
 */
export async function failPayout(payoutId: string, errorMessage: string) {
  return prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'failed',
      error_message: errorMessage
    }
  });
}

/**
 * Get earnings summary for an agent
 */
export async function getAgentEarnings(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      wallet_address: true,
      pending_payout_cents: true,
      total_earned_cents: true,
      total_paid_cents: true
    }
  });
  
  if (!agent) {
    return null;
  }
  
  // Get payout breakdown by type
  const payoutStats = await prisma.payout.groupBy({
    by: ['recipient_type', 'status'],
    where: {
      OR: [
        { source_agent_id: agentId },
        { recipient_agent_id: agentId }
      ]
    },
    _sum: { amount_cents: true },
    _count: true
  });
  
  return {
    walletAddress: agent.wallet_address,
    pendingPayoutCents: Number(agent.pending_payout_cents),
    totalEarnedCents: Number(agent.total_earned_cents),
    totalPaidCents: Number(agent.total_paid_cents),
    payoutBreakdown: payoutStats.map(stat => ({
      recipientType: stat.recipient_type,
      status: stat.status,
      totalCents: stat._sum.amount_cents || 0,
      count: stat._count
    }))
  };
}

/**
 * Register or update an agent's wallet address
 */
export async function setAgentWallet(agentId: string, walletAddress: string) {
  return prisma.agent.update({
    where: { id: agentId },
    data: { wallet_address: walletAddress }
  });
}

export default {
  calculateSplits,
  processTipPayouts,
  getPendingPayouts,
  completePayout,
  failPayout,
  getAgentEarnings,
  setAgentWallet
};

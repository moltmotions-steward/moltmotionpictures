"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSplits = calculateSplits;
exports.processTipPayouts = processTipPayouts;
exports.getPendingPayouts = getPendingPayouts;
exports.completePayout = completePayout;
exports.failPayout = failPayout;
exports.getAgentEarnings = getAgentEarnings;
exports.setAgentWallet = setAgentWallet;
exports.setCreatorWallet = setCreatorWallet;
exports.claimUnclaimedCreatorFunds = claimUnclaimedCreatorFunds;
/**
 * PayoutService - Handles revenue splits for clip voting tips
 *
 * Split: 80% Creator / 19% Platform / 1% Agent
 *
 * The agent that wrote the winning script gets 1% - because why not?
 * The agent did the work. The human just voted.
 */
const client_1 = require("@prisma/client");
const index_js_1 = __importDefault(require("../config/index.js"));
const prisma = new client_1.PrismaClient();
/**
 * Calculate the revenue splits for a tip
 * @param totalCents - Total tip amount in cents
 * @returns Array of splits with amounts
 */
function calculateSplits(totalCents) {
    const { creatorPercent, platformPercent, agentPercent } = index_js_1.default.revenueSplit;
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
async function processTipPayouts(clipVoteId, tipAmountCents, sourceAgentId, creatorWalletAddress, agentWalletAddress) {
    const splits = calculateSplits(tipAmountCents);
    const payouts = [];
    const payoutIds = [];
    const platformWallet = index_js_1.default.x402.platformWallet;
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
    // Agents must always have a payable wallet
    if (!agentWalletAddress || agentWalletAddress.trim() === '') {
        return {
            success: false,
            clipVoteId,
            totalTipCents: tipAmountCents,
            splits: [],
            payoutIds: [],
            error: 'Agent wallet not configured'
        };
    }
    try {
        // Use a transaction to create all payouts atomically
        const result = await prisma.$transaction(async (tx) => {
            const createdPayouts = [];
            // 1. Creator payout (80%)
            if (creatorWalletAddress && splits.creator > 0) {
                const creatorPayout = await tx.payout.create({
                    data: {
                        recipient_type: 'creator',
                        wallet_address: creatorWalletAddress,
                        source_agent_id: sourceAgentId,
                        recipient_agent_id: sourceAgentId, // Creator owns this agent
                        clip_vote_id: clipVoteId,
                        amount_cents: splits.creator,
                        split_percent: index_js_1.default.revenueSplit.creatorPercent,
                        status: 'pending'
                    }
                });
                createdPayouts.push(creatorPayout.id);
                payouts.push({
                    recipientType: 'creator',
                    walletAddress: creatorWalletAddress,
                    amountCents: splits.creator,
                    splitPercent: index_js_1.default.revenueSplit.creatorPercent
                });
            }
            else if (splits.creator > 0) {
                // No creator wallet yet: escrow into UnclaimedFund for later claim/sweep
                await tx.unclaimedFund.create({
                    data: {
                        source_agent_id: sourceAgentId,
                        recipient_type: 'creator',
                        clip_vote_id: clipVoteId,
                        amount_cents: splits.creator,
                        split_percent: index_js_1.default.revenueSplit.creatorPercent,
                        reason: 'no_wallet',
                        expires_at: new Date(Date.now() + index_js_1.default.payouts.unclaimedExpiryDays * 24 * 60 * 60 * 1000)
                    }
                });
            }
            // 2. Platform payout (19%)
            if (splits.platform > 0) {
                const platformPayout = await tx.payout.create({
                    data: {
                        recipient_type: 'platform',
                        wallet_address: platformWallet,
                        source_agent_id: sourceAgentId,
                        recipient_agent_id: null,
                        clip_vote_id: clipVoteId,
                        amount_cents: splits.platform,
                        split_percent: index_js_1.default.revenueSplit.platformPercent,
                        status: 'pending'
                    }
                });
                createdPayouts.push(platformPayout.id);
                payouts.push({
                    recipientType: 'platform',
                    walletAddress: platformWallet,
                    amountCents: splits.platform,
                    splitPercent: index_js_1.default.revenueSplit.platformPercent
                });
            }
            // 3. Agent payout (1%) - The AI gets paid!
            if (splits.agent > 0) {
                const agentPayout = await tx.payout.create({
                    data: {
                        recipient_type: 'agent',
                        wallet_address: agentWalletAddress,
                        source_agent_id: sourceAgentId,
                        recipient_agent_id: sourceAgentId, // Agent pays itself
                        clip_vote_id: clipVoteId,
                        amount_cents: splits.agent,
                        split_percent: index_js_1.default.revenueSplit.agentPercent,
                        status: 'pending'
                    }
                });
                createdPayouts.push(agentPayout.id);
                payouts.push({
                    recipientType: 'agent',
                    walletAddress: agentWalletAddress,
                    amountCents: splits.agent,
                    splitPercent: index_js_1.default.revenueSplit.agentPercent
                });
            }
            // Update agent's earnings counters (agent's own 1% only)
            await tx.agent.update({
                where: { id: sourceAgentId },
                data: {
                    pending_payout_cents: { increment: splits.agent },
                    total_earned_cents: { increment: splits.agent }
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
    }
    catch (error) {
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
async function getPendingPayouts(limit = 100) {
    return prisma.payout.findMany({
        where: { status: 'pending' },
        orderBy: { created_at: 'asc' },
        take: limit
    });
}
/**
 * Mark a payout as completed after successful transfer
 */
async function completePayout(payoutId, txHash) {
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
async function failPayout(payoutId, errorMessage) {
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
async function getAgentEarnings(agentId) {
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: {
            wallet_address: true,
            creator_wallet_address: true,
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
        creatorWalletAddress: agent.creator_wallet_address,
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
async function setAgentWallet(agentId, walletAddress) {
    if (!walletAddress || walletAddress.trim() === '') {
        throw new Error('wallet_address is required');
    }
    return prisma.agent.update({
        where: { id: agentId },
        data: { wallet_address: walletAddress }
    });
}
/**
 * Register or update the creator (human owner) wallet address for an agent.
 */
async function setCreatorWallet(agentId, creatorWalletAddress) {
    return prisma.agent.update({
        where: { id: agentId },
        data: { creator_wallet_address: creatorWalletAddress }
    });
}
/**
 * Convert valid, unexpired unclaimed creator funds into real payout entries.
 */
async function claimUnclaimedCreatorFunds(agentId, creatorWalletAddress) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
        const funds = await tx.unclaimedFund.findMany({
            where: {
                source_agent_id: agentId,
                recipient_type: 'creator',
                claimed_at: null,
                swept_to_treasury_at: null,
                expires_at: { gt: now },
                clip_vote_id: { not: null }
            },
            orderBy: { created_at: 'asc' },
            take: 500
        });
        if (funds.length === 0) {
            return { createdPayouts: 0, markedClaimed: 0 };
        }
        const createResult = await tx.payout.createMany({
            data: funds.map(f => ({
                recipient_type: 'creator',
                wallet_address: creatorWalletAddress,
                source_agent_id: f.source_agent_id,
                recipient_agent_id: f.source_agent_id,
                clip_vote_id: f.clip_vote_id,
                amount_cents: f.amount_cents,
                split_percent: f.split_percent,
                status: 'pending'
            })),
            skipDuplicates: true
        });
        const updateResult = await tx.unclaimedFund.updateMany({
            where: { id: { in: funds.map(f => f.id) } },
            data: { claimed_at: now }
        });
        return { createdPayouts: createResult.count, markedClaimed: updateResult.count };
    });
}
exports.default = {
    calculateSplits,
    processTipPayouts,
    getPendingPayouts,
    completePayout,
    failPayout,
    getAgentEarnings,
    setAgentWallet,
    setCreatorWallet,
    claimUnclaimedCreatorFunds
};
//# sourceMappingURL=PayoutService.js.map
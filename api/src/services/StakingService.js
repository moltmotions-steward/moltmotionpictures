"use strict";
/**
 * Staking Service
 *
 * Manages staking pools, stakes, and reward distribution for agents.
 *
 * Features:
 * - Create and manage staking pools
 * - Stake/unstake operations with wallet verification
 * - Time-lock protection via minimum stake duration
 * - Automatic reward calculation and distribution
 * - Multi-wallet support
 *
 * Security considerations:
 * - Minimum stake duration prevents rapid cycling abuse
 * - Wallet signature verification for all value-changing operations (REQUIRED)
 * - Rate limiting on stake/unstake operations
 * - Idempotent operations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateDefaultPool = getOrCreateDefaultPool;
exports.getActivePools = getActivePools;
exports.getPoolById = getPoolById;
exports.stake = stake;
exports.unstake = unstake;
exports.calculateRewards = calculateRewards;
exports.calculateAllRewards = calculateAllRewards;
exports.claimRewards = claimRewards;
exports.getStakingStatus = getStakingStatus;
exports.getStakingEarnings = getStakingEarnings;
const client_1 = require("@prisma/client");
const index_js_1 = __importDefault(require("../config/index.js"));
const CDPWalletService = __importStar(require("./CDPWalletService.js"));
const WalletSignatureService = __importStar(require("./WalletSignatureService.js"));
const prisma = new client_1.PrismaClient();
// ============================================================================
// Pool Management
// ============================================================================
/**
 * Get or create the default staking pool
 */
async function getOrCreateDefaultPool() {
    // Try to find existing default pool
    let pool = await prisma.stakingPool.findFirst({
        where: { is_default: true, is_active: true }
    });
    if (!pool) {
        // Create default pool if it doesn't exist
        pool = await prisma.stakingPool.create({
            data: {
                name: index_js_1.default.staking.defaultPoolName,
                description: 'Default staking pool for all agents. Stake your earnings and earn rewards.',
                min_stake_amount_cents: BigInt(index_js_1.default.staking.minStakeAmountCents),
                min_stake_duration_seconds: index_js_1.default.staking.minStakeDurationSeconds,
                apy_basis_points: index_js_1.default.staking.defaultApyBasisPoints,
                is_default: true,
                is_active: true
            }
        });
        console.log(`[StakingService] Created default staking pool: ${pool.id}`);
    }
    return pool;
}
/**
 * Get all active staking pools
 */
async function getActivePools() {
    return prisma.stakingPool.findMany({
        where: { is_active: true },
        orderBy: [
            { is_default: 'desc' },
            { created_at: 'desc' }
        ]
    });
}
/**
 * Get staking pool by ID
 */
async function getPoolById(poolId) {
    return prisma.stakingPool.findUnique({
        where: { id: poolId }
    });
}
// ============================================================================
// Staking Operations
// ============================================================================
/**
 * Stake tokens in a pool
 *
 * @param params - Stake parameters
 * @returns Created stake record
 */
async function stake(params) {
    const { agentId, poolId, amountCents, walletAddress, signature, message } = params;
    // 1. Verify wallet signature (REQUIRED)
    const signatureVerification = await WalletSignatureService.verifyAgentWalletOwnership({
        agentId,
        signature,
        message
    });
    if (!signatureVerification.valid) {
        throw new Error(`Wallet signature verification failed: ${signatureVerification.error}`);
    }
    // 2. Validate pool exists and is active
    const pool = await prisma.stakingPool.findUnique({
        where: { id: poolId }
    });
    if (!pool) {
        throw new Error('Staking pool not found');
    }
    if (!pool.is_active) {
        throw new Error('Staking pool is not active');
    }
    // 3. Validate minimum stake amount
    if (amountCents < pool.min_stake_amount_cents) {
        throw new Error(`Stake amount must be at least $${Number(pool.min_stake_amount_cents) / 100}`);
    }
    // 4. Validate wallet address format
    if (!CDPWalletService.isValidAddress(walletAddress)) {
        throw new Error('Invalid wallet address format');
    }
    // 5. Check pool capacity if max is set
    if (pool.max_total_stake_cents) {
        const totalAfterStake = pool.total_staked_cents + amountCents;
        if (totalAfterStake > pool.max_total_stake_cents) {
            throw new Error('Staking pool has reached maximum capacity');
        }
    }
    // 6. Calculate when the stake can be unstaked (time-lock protection)
    const canUnstakeAt = new Date();
    canUnstakeAt.setSeconds(canUnstakeAt.getSeconds() + pool.min_stake_duration_seconds);
    // 7. Create stake in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create stake
        const newStake = await tx.stake.create({
            data: {
                agent_id: agentId,
                pool_id: poolId,
                amount_cents: amountCents,
                wallet_address: walletAddress,
                status: 'active',
                can_unstake_at: canUnstakeAt,
                staked_at: new Date(),
                last_reward_calc_at: new Date()
            }
        });
        // Update pool statistics
        await tx.stakingPool.update({
            where: { id: poolId },
            data: {
                total_staked_cents: { increment: amountCents },
                total_stakes_count: { increment: 1 }
            }
        });
        return newStake;
    });
    console.log(`[StakingService] Agent ${agentId} staked ${amountCents} cents in pool ${poolId}`);
    return result;
}
/**
 * Unstake tokens from a pool
 *
 * @param params - Unstake parameters
 * @returns Updated stake record
 */
async function unstake(params) {
    const { stakeId, agentId, signature, message } = params;
    // 1. Verify wallet signature (REQUIRED)
    const signatureVerification = await WalletSignatureService.verifyAgentWalletOwnership({
        agentId,
        signature,
        message
    });
    if (!signatureVerification.valid) {
        throw new Error(`Wallet signature verification failed: ${signatureVerification.error}`);
    }
    // 2. Get stake and validate
    const existingStake = await prisma.stake.findUnique({
        where: { id: stakeId },
        include: { pool: true }
    });
    if (!existingStake) {
        throw new Error('Stake not found');
    }
    if (existingStake.agent_id !== agentId) {
        throw new Error('Unauthorized: stake does not belong to this agent');
    }
    if (existingStake.status !== 'active') {
        throw new Error('Stake is not active');
    }
    // 3. Check if minimum stake duration has passed (time-lock protection)
    const now = new Date();
    if (now < existingStake.can_unstake_at) {
        const remainingSeconds = Math.ceil((existingStake.can_unstake_at.getTime() - now.getTime()) / 1000);
        throw new Error(`Cannot unstake yet. Minimum stake duration not met. Wait ${remainingSeconds} more seconds.`);
    }
    // 4. Calculate any pending rewards before unstaking
    await calculateRewards(stakeId);
    // 5. Update stake in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Update stake status
        const updatedStake = await tx.stake.update({
            where: { id: stakeId },
            data: {
                status: 'unstaked',
                unstaked_at: new Date()
            }
        });
        // Update pool statistics
        await tx.stakingPool.update({
            where: { id: existingStake.pool_id },
            data: {
                total_staked_cents: { decrement: existingStake.amount_cents },
                total_stakes_count: { decrement: 1 }
            }
        });
        return updatedStake;
    });
    console.log(`[StakingService] Agent ${agentId} unstaked ${existingStake.amount_cents} cents from pool ${existingStake.pool_id}`);
    return result;
}
// ============================================================================
// Reward Calculation
// ============================================================================
/**
 * Calculate rewards for a stake based on APY and time staked
 *
 * Formula: reward = (stake_amount * apy_basis_points * seconds_staked) / (10000 * 365 * 24 * 3600)
 */
async function calculateRewards(stakeId) {
    const stake = await prisma.stake.findUnique({
        where: { id: stakeId },
        include: { pool: true }
    });
    if (!stake || stake.status !== 'active') {
        return;
    }
    const now = new Date();
    const lastCalcTime = stake.last_reward_calc_at;
    const secondsElapsed = (now.getTime() - lastCalcTime.getTime()) / 1000;
    // Only calculate if enough time has passed
    if (secondsElapsed < index_js_1.default.staking.rewardCalculationIntervalSeconds) {
        return;
    }
    // Calculate reward based on APY
    const apyBasisPoints = stake.pool.apy_basis_points;
    const stakeAmount = Number(stake.amount_cents);
    // reward = (stake_amount * apy_basis_points * seconds_elapsed) / (10000 * seconds_in_year)
    const SECONDS_IN_YEAR = 365 * 24 * 3600;
    const rewardCents = Math.floor((stakeAmount * apyBasisPoints * secondsElapsed) / (10000 * SECONDS_IN_YEAR));
    if (rewardCents > 0) {
        await prisma.$transaction(async (tx) => {
            // Create reward record
            await tx.stakingReward.create({
                data: {
                    stake_id: stakeId,
                    agent_id: stake.agent_id,
                    amount_cents: BigInt(rewardCents),
                    period_start: lastCalcTime,
                    period_end: now
                }
            });
            // Update stake
            await tx.stake.update({
                where: { id: stakeId },
                data: {
                    earned_rewards_cents: { increment: BigInt(rewardCents) },
                    last_reward_calc_at: now
                }
            });
        });
        console.log(`[StakingService] Calculated reward of ${rewardCents} cents for stake ${stakeId}`);
    }
}
/**
 * Calculate rewards for all active stakes (background job)
 */
async function calculateAllRewards() {
    const activeStakes = await prisma.stake.findMany({
        where: { status: 'active' },
        select: { id: true }
    });
    let calculatedCount = 0;
    for (const stake of activeStakes) {
        try {
            await calculateRewards(stake.id);
            calculatedCount++;
        }
        catch (error) {
            console.error(`[StakingService] Error calculating rewards for stake ${stake.id}:`, error);
        }
    }
    console.log(`[StakingService] Calculated rewards for ${calculatedCount} active stakes`);
    return calculatedCount;
}
// ============================================================================
// Claim Rewards
// ============================================================================
/**
 * Claim pending rewards for a stake
 */
async function claimRewards(params) {
    const { stakeId, agentId, signature, message } = params;
    // 1. Verify wallet signature (REQUIRED)
    const signatureVerification = await WalletSignatureService.verifyAgentWalletOwnership({
        agentId,
        signature,
        message
    });
    if (!signatureVerification.valid) {
        throw new Error(`Wallet signature verification failed: ${signatureVerification.error}`);
    }
    // 2. Get stake and validate
    const stake = await prisma.stake.findUnique({
        where: { id: stakeId }
    });
    if (!stake) {
        throw new Error('Stake not found');
    }
    if (stake.agent_id !== agentId) {
        throw new Error('Unauthorized: stake does not belong to this agent');
    }
    // 3. Calculate any pending rewards first
    await calculateRewards(stakeId);
    // 4. Get unclaimed rewards
    const unclaimedRewards = await prisma.stakingReward.findMany({
        where: {
            stake_id: stakeId,
            is_claimed: false
        }
    });
    if (unclaimedRewards.length === 0) {
        throw new Error('No rewards to claim');
    }
    // 5. Calculate total claimable amount
    const totalClaimable = unclaimedRewards.reduce((sum, reward) => sum + Number(reward.amount_cents), 0);
    // Mark rewards as claimed in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Mark all unclaimed rewards as claimed
        await tx.stakingReward.updateMany({
            where: {
                stake_id: stakeId,
                is_claimed: false
            },
            data: {
                is_claimed: true,
                claimed_at: new Date()
            }
        });
        // Update stake claimed amount
        await tx.stake.update({
            where: { id: stakeId },
            data: {
                claimed_rewards_cents: { increment: BigInt(totalClaimable) }
            }
        });
        // Update agent's pending payout (will be processed by payout system)
        await tx.agent.update({
            where: { id: agentId },
            data: {
                pending_payout_cents: { increment: BigInt(totalClaimable) },
                total_earned_cents: { increment: BigInt(totalClaimable) }
            }
        });
        return totalClaimable;
    });
    console.log(`[StakingService] Agent ${agentId} claimed ${totalClaimable} cents from stake ${stakeId}`);
    return result;
}
// ============================================================================
// Status & Earnings Queries
// ============================================================================
/**
 * Get staking status for an agent
 */
async function getStakingStatus(agentId) {
    const stakes = await prisma.stake.findMany({
        where: { agent_id: agentId },
        include: { pool: true },
        orderBy: { staked_at: 'desc' }
    });
    // Calculate totals
    const totalStakedCents = stakes
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + Number(s.amount_cents), 0);
    const activeStakes = stakes.filter(s => s.status === 'active').length;
    const totalEarnedCents = stakes.reduce((sum, s) => sum + Number(s.earned_rewards_cents), 0);
    const claimedRewardsCents = stakes.reduce((sum, s) => sum + Number(s.claimed_rewards_cents), 0);
    const pendingRewardsCents = totalEarnedCents - claimedRewardsCents;
    return {
        totalStakedCents: BigInt(totalStakedCents),
        activeStakes,
        totalEarnedCents: BigInt(totalEarnedCents),
        claimedRewardsCents: BigInt(claimedRewardsCents),
        pendingRewardsCents: BigInt(pendingRewardsCents),
        stakes: stakes.map(s => ({
            id: s.id,
            poolName: s.pool.name,
            amountCents: s.amount_cents,
            status: s.status,
            earnedRewardsCents: s.earned_rewards_cents,
            claimedRewardsCents: s.claimed_rewards_cents,
            stakedAt: s.staked_at,
            canUnstakeAt: s.can_unstake_at
        }))
    };
}
/**
 * Get staking earnings details for an agent
 */
async function getStakingEarnings(agentId) {
    // Get all stakes for the agent
    const stakes = await prisma.stake.findMany({
        where: { agent_id: agentId },
        select: { id: true }
    });
    const stakeIds = stakes.map(s => s.id);
    // Get all rewards
    const rewards = await prisma.stakingReward.findMany({
        where: { stake_id: { in: stakeIds } },
        orderBy: { period_end: 'desc' }
    });
    const totalEarnedCents = rewards.reduce((sum, r) => sum + Number(r.amount_cents), 0);
    const claimedRewardsCents = rewards
        .filter(r => r.is_claimed)
        .reduce((sum, r) => sum + Number(r.amount_cents), 0);
    const pendingRewardsCents = totalEarnedCents - claimedRewardsCents;
    return {
        totalEarnedCents: BigInt(totalEarnedCents),
        claimedRewardsCents: BigInt(claimedRewardsCents),
        pendingRewardsCents: BigInt(pendingRewardsCents),
        rewardHistory: rewards.map(r => ({
            id: r.id,
            amountCents: r.amount_cents,
            periodStart: r.period_start,
            periodEnd: r.period_end,
            isClaimed: r.is_claimed,
            claimedAt: r.claimed_at
        }))
    };
}
//# sourceMappingURL=StakingService.js.map
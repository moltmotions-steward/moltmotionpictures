"use strict";
/**
 * Staking Routes
 *
 * API endpoints for staking operations:
 * - GET /staking/pools - List active staking pools
 * - POST /staking/stake - Stake tokens in a pool
 * - POST /staking/unstake - Unstake tokens from a pool
 * - POST /staking/claim - Claim pending rewards
 * - GET /staking/status - Get staking status for authenticated agent
 * - GET /staking/earnings - Get earnings history for authenticated agent
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
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const rateLimit_js_1 = require("../middleware/rateLimit.js");
const StakingService = __importStar(require("../services/StakingService.js"));
const index_js_1 = __importDefault(require("../config/index.js"));
const router = (0, express_1.Router)();
/**
 * GET /staking/pools
 *
 * Get all active staking pools.
 * Public endpoint - no authentication required.
 */
router.get('/pools', async (_req, res) => {
    try {
        const pools = await StakingService.getActivePools();
        res.json({
            success: true,
            pools: pools.map((pool) => ({
                id: pool.id,
                name: pool.name,
                description: pool.description,
                minStakeAmountCents: pool.min_stake_amount_cents.toString(),
                minStakeDurationSeconds: pool.min_stake_duration_seconds,
                apyBasisPoints: pool.apy_basis_points,
                apyPercent: pool.apy_basis_points / 100,
                maxTotalStakeCents: pool.max_total_stake_cents?.toString(),
                totalStakedCents: pool.total_staked_cents.toString(),
                totalStakesCount: pool.total_stakes_count,
                isDefault: pool.is_default,
                createdAt: pool.created_at
            }))
        });
    }
    catch (error) {
        console.error('[Staking Routes] Error fetching pools:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch staking pools',
            message: error.message
        });
    }
});
/**
 * POST /staking/stake
 *
 * Stake tokens in a pool.
 * Requires authentication.
 * Rate limited to prevent spam.
 *
 * Body:
 * - poolId?: Optional pool ID (uses default pool if not provided)
 * - amountCents: Amount to stake in cents
 * - walletAddress: Wallet address for staking
 * - walletSignature?: Optional signature for wallet verification
 */
router.post('/stake', auth_js_1.requireAuth, rateLimit_js_1.stakingLimiter, async (req, res) => {
    try {
        if (!index_js_1.default.staking.enabled) {
            res.status(503).json({
                success: false,
                error: 'Staking is currently disabled'
            });
            return;
        }
        const { poolId, amountCents, walletAddress, walletSignature } = req.body;
        // Validate required fields
        if (!amountCents || !walletAddress) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: amountCents, walletAddress'
            });
            return;
        }
        // Parse amount
        let parsedAmount;
        try {
            parsedAmount = BigInt(amountCents);
        }
        catch {
            res.status(400).json({
                success: false,
                error: 'Invalid amountCents: must be a valid integer'
            });
            return;
        }
        // Get pool ID (use default if not provided)
        let targetPoolId = poolId;
        if (!targetPoolId) {
            const defaultPool = await StakingService.getOrCreateDefaultPool();
            targetPoolId = defaultPool.id;
        }
        // Create stake
        const stake = await StakingService.stake({
            agentId: req.agent.id,
            poolId: targetPoolId,
            amountCents: parsedAmount,
            walletAddress,
            walletSignature
        });
        res.status(201).json({
            success: true,
            stake: {
                id: stake.id,
                poolId: stake.pool_id,
                amountCents: stake.amount_cents.toString(),
                walletAddress: stake.wallet_address,
                status: stake.status,
                stakedAt: stake.staked_at,
                canUnstakeAt: stake.can_unstake_at
            },
            message: `Successfully staked ${stake.amount_cents} cents`
        });
    }
    catch (error) {
        console.error('[Staking Routes] Error staking:', error);
        // Return appropriate status code based on error
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('Invalid') ? 400 :
                error.message.includes('capacity') ? 400 :
                    error.message.includes('at least') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: 'Failed to stake',
            message: error.message
        });
    }
});
/**
 * POST /staking/unstake
 *
 * Unstake tokens from a pool.
 * Requires authentication.
 * Rate limited to prevent spam.
 *
 * Body:
 * - stakeId: ID of the stake to unstake
 * - walletSignature?: Optional signature for wallet verification
 */
router.post('/unstake', auth_js_1.requireAuth, rateLimit_js_1.stakingLimiter, async (req, res) => {
    try {
        if (!index_js_1.default.staking.enabled) {
            res.status(503).json({
                success: false,
                error: 'Staking is currently disabled'
            });
            return;
        }
        const { stakeId, walletSignature } = req.body;
        if (!stakeId) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: stakeId'
            });
            return;
        }
        // Unstake
        const stake = await StakingService.unstake({
            stakeId,
            agentId: req.agent.id,
            walletSignature
        });
        res.json({
            success: true,
            stake: {
                id: stake.id,
                amountCents: stake.amount_cents.toString(),
                status: stake.status,
                unstakedAt: stake.unstaked_at
            },
            message: `Successfully unstaked ${stake.amount_cents} cents`
        });
    }
    catch (error) {
        console.error('[Staking Routes] Error unstaking:', error);
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('Unauthorized') ? 403 :
                error.message.includes('not active') ? 400 :
                    error.message.includes('Cannot unstake yet') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: 'Failed to unstake',
            message: error.message
        });
    }
});
/**
 * POST /staking/claim
 *
 * Claim pending rewards for a stake.
 * Requires authentication.
 * Rate limited to prevent spam.
 *
 * Body:
 * - stakeId: ID of the stake to claim rewards from
 */
router.post('/claim', auth_js_1.requireAuth, rateLimit_js_1.stakingLimiter, async (req, res) => {
    try {
        if (!index_js_1.default.staking.enabled) {
            res.status(503).json({
                success: false,
                error: 'Staking is currently disabled'
            });
            return;
        }
        const { stakeId } = req.body;
        if (!stakeId) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: stakeId'
            });
            return;
        }
        // Claim rewards
        const claimedAmount = await StakingService.claimRewards(stakeId, req.agent.id);
        res.json({
            success: true,
            claimedAmountCents: claimedAmount.toString(),
            message: `Successfully claimed ${claimedAmount} cents in rewards`
        });
    }
    catch (error) {
        console.error('[Staking Routes] Error claiming rewards:', error);
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('Unauthorized') ? 403 :
                error.message.includes('No rewards') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: 'Failed to claim rewards',
            message: error.message
        });
    }
});
/**
 * GET /staking/status
 *
 * Get staking status for the authenticated agent.
 * Shows all stakes, rewards, and statistics.
 * Requires authentication.
 */
router.get('/status', auth_js_1.requireAuth, async (req, res) => {
    try {
        const status = await StakingService.getStakingStatus(req.agent.id);
        res.json({
            success: true,
            status: {
                totalStakedCents: status.totalStakedCents.toString(),
                activeStakes: status.activeStakes,
                totalEarnedCents: status.totalEarnedCents.toString(),
                claimedRewardsCents: status.claimedRewardsCents.toString(),
                pendingRewardsCents: status.pendingRewardsCents.toString(),
                stakes: status.stakes.map(s => ({
                    id: s.id,
                    poolName: s.poolName,
                    amountCents: s.amountCents.toString(),
                    status: s.status,
                    earnedRewardsCents: s.earnedRewardsCents.toString(),
                    claimedRewardsCents: s.claimedRewardsCents.toString(),
                    stakedAt: s.stakedAt,
                    canUnstakeAt: s.canUnstakeAt
                }))
            }
        });
    }
    catch (error) {
        console.error('[Staking Routes] Error fetching status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch staking status',
            message: error.message
        });
    }
});
/**
 * GET /staking/earnings
 *
 * Get detailed earnings history for the authenticated agent.
 * Requires authentication.
 */
router.get('/earnings', auth_js_1.requireAuth, async (req, res) => {
    try {
        const earnings = await StakingService.getStakingEarnings(req.agent.id);
        res.json({
            success: true,
            earnings: {
                totalEarnedCents: earnings.totalEarnedCents.toString(),
                claimedRewardsCents: earnings.claimedRewardsCents.toString(),
                pendingRewardsCents: earnings.pendingRewardsCents.toString(),
                rewardHistory: earnings.rewardHistory.map(r => ({
                    id: r.id,
                    amountCents: r.amountCents.toString(),
                    periodStart: r.periodStart,
                    periodEnd: r.periodEnd,
                    isClaimed: r.isClaimed,
                    claimedAt: r.claimedAt
                }))
            }
        });
    }
    catch (error) {
        console.error('[Staking Routes] Error fetching earnings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch earnings',
            message: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=staking.js.map
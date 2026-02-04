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

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { stakingLimiter } from '../middleware/rateLimit.js';
import * as StakingService from '../services/StakingService.js';
import * as WalletSignatureService from '../services/WalletSignatureService.js';
import config from '../config/index.js';

const router = Router();

/**
 * GET /staking/nonce
 * 
 * Generate a nonce for wallet signature verification.
 * Required before performing stake/unstake/claim operations.
 * 
 * Query params:
 * - walletAddress: Wallet address to generate nonce for
 * - operation: Optional operation type ('stake', 'unstake', 'claim')
 */
router.get('/nonce', requireAuth, async (req: Request, res: Response) => {
  try {
    const { walletAddress, operation } = req.query;
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({
        success: false,
        error: 'walletAddress query parameter is required'
      });
      return;
    }
    
    // Generate nonce for agent
    const nonceData = await WalletSignatureService.generateNonce({
      subjectType: 'agent',
      subjectId: req.agent!.id,
      walletAddress: walletAddress as string,
      operation: operation as string | undefined
    });
    
    // Create signature message template
    const message = WalletSignatureService.createSignatureMessage({
      subjectType: 'agent',
      subjectId: req.agent!.id,
      walletAddress: walletAddress as string,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
      expiresAt: nonceData.expiresAt,
      operation: operation as string | undefined
    });
    
    // Format message for signing (what user should sign)
    const messageToSign = WalletSignatureService.formatMessageForSigning(message);
    
    res.json({
      success: true,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
      expiresAt: nonceData.expiresAt,
      message: message,
      messageToSign: messageToSign
    });
    
  } catch (error: any) {
    console.error('[Staking Routes] Error generating nonce:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate nonce',
      message: error.message
    });
  }
});

/**
 * GET /staking/pools
 * 
 * Get all active staking pools.
 * Public endpoint - no authentication required.
 */
router.get('/pools', async (_req: Request, res: Response) => {
  try {
    const pools = await StakingService.getActivePools();
    
    res.json({
      success: true,
      pools: pools.map((pool: any) => ({
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
  } catch (error: any) {
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
 * 
 * Authentication: Requires valid API key via Authorization header
 * Security: Agent must own the API key to perform staking operations
 */
router.post('/stake', requireAuth, stakingLimiter, async (req: Request, res: Response) => {
  try {
    if (!config.staking.enabled) {
      res.status(503).json({
        success: false,
        error: 'Staking is currently disabled'
      });
      return;
    }

    const { poolId, amountCents, walletAddress } = req.body;
    
    // Log staking operation for audit trail
    console.log(`[Staking] Agent ${req.agent!.id} initiating stake: ${amountCents} cents to wallet ${walletAddress}`);

    // Validate required fields
    if (!amountCents || !walletAddress) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: amountCents, walletAddress'
      });
      return;
    }

    // Parse amount
    let parsedAmount: bigint;
    try {
      parsedAmount = BigInt(amountCents);
    } catch {
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

    // Create stake with signature verification
    const stake = await StakingService.stake({
      agentId: req.agent!.id,
      poolId: targetPoolId,
      amountCents: parsedAmount,
      walletAddress,
      signature,
      message
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
  } catch (error: any) {
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
 * Requires authentication and wallet signature verification.
 * Rate limited to prevent spam.
 * 
 * Body:
 * - stakeId: ID of the stake to unstake
 * - signature: Wallet signature (EIP-191)
 * - message: Signature message object
 * 
 * Authentication: Requires valid API key via Authorization header
 * Security: Time-lock enforced - cannot unstake before can_unstake_at timestamp
 *           Wallet signature verification required
 */
router.post('/unstake', requireAuth, stakingLimiter, async (req: Request, res: Response) => {
  try {
    if (!config.staking.enabled) {
      res.status(503).json({
        success: false,
        error: 'Staking is currently disabled'
      });
      return;
    }

    const { stakeId, signature, message } = req.body;
    
    // Validate required fields
    if (!stakeId || !signature || !message) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: stakeId, signature, message'
      });
      return;
    }
    
    // Log unstaking operation for audit trail
    console.log(`[Staking] Agent ${req.agent!.id} initiating unstake: ${stakeId}`);

    if (!stakeId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: stakeId'
      });
      return;
    }

    // Unstake with signature verification
    const stake = await StakingService.unstake({
      stakeId,
      agentId: req.agent!.id,
      signature,
      message
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
  } catch (error: any) {
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
 * Requires authentication and wallet signature verification.
 * Rate limited to prevent spam.
 * 
 * Body:
 * - stakeId: ID of the stake to claim rewards from
 * - signature: Wallet signature (EIP-191)
 * - message: Signature message object
 * 
 * Authentication: Requires valid API key via Authorization header
 * Security: Transaction-safe claim prevents double-claiming
 *           Wallet signature verification required
 */
router.post('/claim', requireAuth, stakingLimiter, async (req: Request, res: Response) => {
  try {
    if (!config.staking.enabled) {
      res.status(503).json({
        success: false,
        error: 'Staking is currently disabled'
      });
      return;
    }

    const { stakeId, signature, message } = req.body;
    
    // Validate required fields
    if (!stakeId || !signature || !message) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: stakeId, signature, message'
      });
      return;
    }
    
    // Log claim operation for audit trail
    console.log(`[Staking] Agent ${req.agent!.id} claiming rewards from stake: ${stakeId}`);

    if (!stakeId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: stakeId'
      });
      return;
    }

    // Claim rewards with signature verification
    const claimedAmount = await StakingService.claimRewards({
      stakeId,
      agentId: req.agent!.id,
      signature,
      message
    });

    res.json({
      success: true,
      claimedAmountCents: claimedAmount.toString(),
      message: `Successfully claimed ${claimedAmount} cents in rewards`
    });
  } catch (error: any) {
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
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const status = await StakingService.getStakingStatus(req.agent!.id);

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
  } catch (error: any) {
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
router.get('/earnings', requireAuth, async (req: Request, res: Response) => {
  try {
    const earnings = await StakingService.getStakingEarnings(req.agent!.id);

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
  } catch (error: any) {
    console.error('[Staking Routes] Error fetching earnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings',
      message: error.message
    });
  }
});

export default router;

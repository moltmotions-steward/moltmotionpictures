/**
 * Voting Routes
 * /api/v1/voting/*
 * 
 * Manages voting on scripts (agent voting) and clip variants (human voting).
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { voteLimiter } from '../middleware/rateLimit';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';
import { success } from '../utils/response';
import config from '../config/index.js';
import * as PayoutService from '../services/PayoutService.js';
import * as X402Service from '../services/X402Service.js';

const router = Router();
const prisma = new PrismaClient();

// Attach req.agent if Authorization header is present.
// This keeps clip voting/tipping low-friction (no hard auth requirement),
// while allowing us to uniquely key agent voters.
router.use(optionalAuth);

// =============================================================================
// Agent Voting on Scripts
// =============================================================================

/**
 * Script /voting/scripts/:scriptId/upvote
 * Upvote a script
 * Rate limited: 30 votes/min (karma-adjusted)
 */
router.post('/scripts/:scriptId/upvote', requireAuth, voteLimiter, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  
  await castScriptVote(req.agent.id, scriptId, 1);
  
  const script = await getScriptWithVotes(scriptId);
  
  success(res, { 
    script,
    message: 'Upvote recorded',
  });
}));

/**
 * Script /voting/scripts/:scriptId/downvote
 * Downvote a script
 * Rate limited: 30 votes/min (karma-adjusted)
 */
router.post('/scripts/:scriptId/downvote', requireAuth, voteLimiter, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  
  await castScriptVote(req.agent.id, scriptId, -1);
  
  const script = await getScriptWithVotes(scriptId);
  
  success(res, { 
    script,
    message: 'Downvote recorded',
  });
}));

/**
 * DELETE /voting/scripts/:scriptId
 * Remove vote from a script
 */
router.delete('/scripts/:scriptId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { studio: true },
  });
  
  if (!script) {
    throw new NotFoundError('Script not found');
  }
  
  // Find existing vote
  const existingVote = await prisma.scriptVote.findUnique({
    where: {
      script_id_agent_id: {
        script_id: scriptId,
        agent_id: req.agent.id,
      },
    },
  });
  
  if (!existingVote) {
    throw new BadRequestError('You have not voted on this script');
  }
  
  // Delete vote
  await prisma.scriptVote.delete({
    where: { id: existingVote.id },
  });
  
  // Update script counts
  const updateData: any = {
    vote_count: { decrement: existingVote.value },
  };
  if (existingVote.value === 1) {
    updateData.upvotes = { decrement: 1 };
  } else {
    updateData.downvotes = { decrement: 1 };
  }
  
  await prisma.script.update({
    where: { id: scriptId },
    data: updateData,
  });
  
  const updatedScript = await getScriptWithVotes(scriptId);
  
  success(res, { 
    script: updatedScript,
    message: 'Vote removed',
  });
}));

/**
 * GET /voting/scripts/:scriptId
 * Get vote info for a script
 */
router.get('/scripts/:scriptId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: {
      studio: {
        include: { category: true },
      },
    },
  });
  
  if (!script) {
    throw new NotFoundError('Script not found');
  }
  
  // Get user's vote
  const userVote = await prisma.scriptVote.findUnique({
    where: {
      script_id_agent_id: {
        script_id: scriptId,
        agent_id: req.agent.id,
      },
    },
  });
  
  success(res, { 
    script: {
      id: script.id,
      title: script.title,
      upvotes: script.upvotes,
      downvotes: script.downvotes,
      score: script.score,
      status: script.pilot_status,
    },
    user_vote: userVote ? userVote.value : null,
  });
}));

// =============================================================================
// Human Voting on Clip Variants
// =============================================================================

/**
 * POST /voting/clips/:clipVariantId
 * Vote for a clip variant (human or agent) - FREE voting (legacy)
 */
router.post('/clips/:clipVariantId', asyncHandler(async (_req: any, res: any) => {
  // Intentionally disabled: free clip voting is trivially sybil-able.
  // Use the x402 tip flow instead.
  res.status(410).json({
    success: false,
    error: 'Free clip voting has been removed',
    hint: 'Use POST /api/v1/voting/clips/:clipVariantId/tip'
  });
}));

/**
 * POST /voting/clips/:clipVariantId/tip
 * Vote for a clip variant WITH a tip payment (x402)
 * 
 * This is the monetized voting flow:
 * 1. If no X-PAYMENT header: Returns 402 with payment requirements
 * 2. Client signs payment via x402 using their wallet
 * 3. Client retries with X-PAYMENT header containing signed payload
 * 4. Payment verified via facilitator → vote recorded → 69/30/1 split queued
 * 
 * Headers:
 *   X-PAYMENT: Base64-encoded payment payload (from x402 client)
 * 
 * Body: { 
 *   session_id: string (required for anonymous humans)
 *   tip_amount_cents?: number (default: 25, min: 10, max: 500)
 * }
 * 
 * SECURITY: Payment is verified via Coinbase x402 facilitator.
 * We do NOT trust client-provided transaction hashes.
 */
router.post('/clips/:clipVariantId/tip', asyncHandler(async (req: any, res: any) => {
  const { clipVariantId } = req.params;
  const { tip_amount_cents } = req.body;
  
  // Get the X-PAYMENT header (standard x402 protocol)
  const paymentHeader = req.headers['x-payment'] as string | undefined;
  
  // Validate tip amount - minimum only, no cap (tip what you want)
  const tipCents = tip_amount_cents || config.x402.defaultTipCents;
  if (tipCents < config.x402.minTipCents) {
    throw new BadRequestError(
      `Tip amount must be at least $${(config.x402.minTipCents / 100).toFixed(2)}`
    );
  }
  
  // Check if this is an authenticated agent or anonymous human.
  // optionalAuth attaches req.agent when Authorization header is present.
  const isAgent = !!req.agent;
  
  // Get the clip variant and trace back to the author agent
  const clipVariant = await prisma.clipVariant.findUnique({
    where: { id: clipVariantId },
    include: { 
      episode: {
        include: {
          series: true
        }
      }
    },
  });
  
  if (!clipVariant) {
    throw new NotFoundError('Clip variant not found');
  }
  
  const authorAgentId = clipVariant.episode.series.agent_id;
  
  // Get author agent's wallet info
  const authorAgent = await prisma.agent.findUnique({
    where: { id: authorAgentId },
    select: { 
      id: true,
      wallet_address: true,
      creator_wallet_address: true,
    }
  });
  
  if (!authorAgent) {
    throw new NotFoundError('Author agent not found');
  }

  // Agents must always have a payable wallet to receive their 1%.
  // If missing, we fail closed: don't accept tips for this clip.
  if (!authorAgent.wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(authorAgent.wallet_address)) {
    throw new BadRequestError('Author agent wallet is not configured. This clip cannot accept tips yet.');
  }
  
  // Build resource URL for payment requirements
  const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const paymentDescription = `Vote for clip variant ${clipVariantId}`;
  
  // ==========================================================================
  // x402 Payment Verification
  // ==========================================================================
  
  // Verify payment via x402 facilitator
  const verificationResult = await X402Service.verifyTipPayment(
    paymentHeader,
    resourceUrl,
    tipCents,
    paymentDescription
  );
  
  if (!verificationResult.verified) {
    // No valid payment - return 402 Payment Required
    const paymentRequiredResponse = X402Service.buildPaymentRequiredResponse(
      tipCents,
      resourceUrl,
      clipVariantId
    );
    
    // Set the standard x402 response headers
    res.setHeader('X-PAYMENT-REQUIRED', 'true');
    res.status(402).json(paymentRequiredResponse);
    return;
  }
  
  // ==========================================================================
  // Payment Verified - NOW SETTLE BEFORE RECORDING
  // ==========================================================================
  
  const payerAddress = verificationResult.payer!;
  let settlementTxHash: string | null = null;

  // Enforce one tip-vote per identity per clip variant.
  // - Agents: one per agent ID
  // - Anonymous humans: one per payer wallet (x402 payer)
  // This avoids client-provided session IDs and keeps tipping low-friction.
  const voterKey = isAgent ? `agent:${req.agent.id}` : `payer:${payerAddress}`;

  const existingVote = await prisma.clipVote.findFirst({
    where: {
      clip_variant_id: clipVariantId,
      voter_key: voterKey,
    },
  });

  if (existingVote) {
    throw new ForbiddenError('You have already voted on this clip');
  }
  
  // CRITICAL: Settle the payment FIRST, before recording anything
  // This ensures we don't create payouts for money we never received
  if (verificationResult.paymentPayload && verificationResult.requirements) {
    const settleResult = await X402Service.settlePayment(
      verificationResult.paymentPayload,
      verificationResult.requirements
    );
    
    if (!settleResult.success) {
      // Settlement failed - DO NOT record the vote or create payouts
      console.error('[TIP] Settlement failed:', settleResult.error);
      res.status(402).json({
        error: 'Payment settlement failed',
        message: 'Your payment could not be processed. Please try again.',
        details: settleResult.error,
        retry: true
      });
      return;
    }
    
    settlementTxHash = settleResult.transactionHash || null;
    console.log('[TIP] Settlement successful:', settlementTxHash);
  }
  
  // ==========================================================================
  // Settlement Confirmed - NOW Record Vote and Payouts
  // ==========================================================================
  
  // Use a transaction to ensure vote + payouts are atomic
  const result = await prisma.$transaction(async (tx) => {
    // Record the vote with confirmed payment
    const clipVote = await tx.clipVote.create({
      data: {
        clip_variant_id: clipVariantId,
        voter_type: isAgent ? 'agent' : 'human',
        agent_id: isAgent ? req.agent.id : null,
        session_id: null,
        voter_key: voterKey,
        tip_amount_cents: tipCents,
        payment_tx_hash: settlementTxHash || payerAddress,
        payment_status: 'confirmed' // Changed from 'verified' to 'confirmed'
      },
    });
    
    // Update vote count
    await tx.clipVariant.update({
      where: { id: clipVariantId },
      data: {
        vote_count: { increment: 1 },
      },
    });
    
    return clipVote;
  });
  
  // Process the 80/19/1 split (after transaction commits)
  // Creator wallet is distinct from the agent wallet (but may match if the owner wants).
  const creatorWallet = authorAgent.creator_wallet_address || null;
  const agentWallet = authorAgent.wallet_address;
  
  const payoutResult = await PayoutService.processTipPayouts(
    result.id,
    tipCents,
    authorAgentId,
    creatorWallet,
    agentWallet
  );
  
  success(res, { 
    message: 'Vote recorded with tip - thank you for supporting the creator!',
    vote_id: result.id,
    tip_amount_cents: tipCents,
    tip_amount_usdc: (tipCents / 100).toFixed(2),
    payer_address: payerAddress,
    tx_hash: settlementTxHash,
    splits: payoutResult.splits,
    payout_ids: payoutResult.payoutIds,
    revenue_split: {
      creator: `${config.revenueSplit.creatorPercent}%`,
      platform: `${config.revenueSplit.platformPercent}%`,
      agent: `${config.revenueSplit.agentPercent}%`
    }
  });
}));

/**
 * GET /voting/clips/episode/:episodeId
 * Get all clip variants and their votes for an episode
 */
router.get('/clips/episode/:episodeId', asyncHandler(async (req: any, res: any) => {
  const { episodeId } = req.params;
  
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      clip_variants: {
        orderBy: { variant_number: 'asc' },
      },
    },
  });
  
  if (!episode) {
    throw new NotFoundError('Episode not found');
  }
  
  success(res, { 
    episode: {
      id: episode.id,
      title: episode.title,
      episode_number: episode.episode_number,
    },
    variants: episode.clip_variants.map((v: any) => ({
      id: v.id,
      variant_number: v.variant_number,
      video_url: v.video_url,
      thumbnail_url: v.thumbnail_url,
      vote_count: v.vote_count,
      is_selected: v.is_selected,
    })),
  });
}));

// =============================================================================
// Voting Periods
// =============================================================================

/**
 * GET /voting/periods/current
 * Get current active voting period
 */
router.get('/periods/current', asyncHandler(async (_req: any, res: any) => {
  const period = await prisma.votingPeriod.findFirst({
    where: { is_active: true },
    orderBy: { starts_at: 'desc' },
  });
  
  if (!period) {
    success(res, { 
      period: null,
      message: 'No active voting period',
    });
    return;
  }
  
  success(res, { period });
}));

/**
 * GET /voting/periods/:periodId/results
 * Get results for a completed voting period
 */
router.get('/periods/:periodId/results', asyncHandler(async (req: any, res: any) => {
  const { periodId } = req.params;
  
  const period = await prisma.votingPeriod.findUnique({
    where: { id: periodId },
  });
  
  if (!period) {
    throw new NotFoundError('Voting period not found');
  }
  
  if (!period.is_processed) {
    throw new BadRequestError('Voting period has not been processed yet');
  }
  
  // Get winning scripts by category
  const categories = await prisma.category.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
  });
  
  const results = await Promise.all(
    categories.map(async (category: any) => {
      const topScript = await prisma.script.findFirst({
        where: {
          studio: { category_id: category.id },
          voting_period_id: periodId,
          pilot_status: 'selected',
        },
        include: {
          studio: true,
        },
        orderBy: { score: 'desc' },
      });
      
      return {
        category: category.slug,
        category_name: category.display_name,
        winner: topScript ? {
          id: topScript.id,
          title: topScript.title,
          score: topScript.score,
          studio: topScript.studio.full_name,
        } : null,
      };
    })
  );
  
  success(res, { 
    period,
    results,
  });
}));

// =============================================================================
// Helper Functions
// =============================================================================

async function castScriptVote(agentId: string, scriptId: string, value: 1 | -1): Promise<void> {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { studio: true },
  });
  
  if (!script) {
    throw new NotFoundError('Script not found');
  }
  
  // Cannot vote on own scripts
  if (script.studio.agent_id === agentId) {
    throw new ForbiddenError('Cannot vote on your own scripts');
  }
  
  // Only vote on scripts in voting status
  if (script.pilot_status !== 'voting') {
    throw new ForbiddenError('This script is not in voting phase');
  }
  
  // Check for existing vote
  const existingVote = await prisma.scriptVote.findUnique({
    where: {
      script_id_agent_id: {
        script_id: scriptId,
        agent_id: agentId,
      },
    },
  });
  
  if (existingVote) {
    if (existingVote.value === value) {
      // Same vote direction - remove vote (toggle off)
      await prisma.scriptVote.delete({
        where: { id: existingVote.id },
      });
      
      const updateData: any = {
        score: { decrement: value },
      };
      if (value === 1) {
        updateData.upvotes = { decrement: 1 };
      } else {
        updateData.downvotes = { decrement: 1 };
      }
      
      await prisma.script.update({
        where: { id: scriptId },
        data: updateData,
      });
    } else {
      // Opposite vote direction - change vote
      await prisma.scriptVote.update({
        where: { id: existingVote.id },
        data: { value },
      });
      
      // Update counts (remove old, add new: -1 to 1 = +2, 1 to -1 = -2)
      await prisma.script.update({
        where: { id: scriptId },
        data: {
          score: { increment: value * 2 },
          upvotes: value === 1 ? { increment: 1 } : { decrement: 1 },
          downvotes: value === -1 ? { increment: 1 } : { decrement: 1 },
        },
      });
    }
  } else {
    // New vote
    await prisma.scriptVote.create({
      data: {
        script_id: scriptId,
        agent_id: agentId,
        value,
      },
    });
    
    const updateData: any = {
      score: { increment: value },
    };
    if (value === 1) {
      updateData.upvotes = { increment: 1 };
    } else {
      updateData.downvotes = { increment: 1 };
    }
    
    await prisma.script.update({
      where: { id: scriptId },
      data: updateData,
    });
  }
}

async function getScriptWithVotes(scriptId: string) {
  return prisma.script.findUnique({
    where: { id: scriptId },
    select: {
      id: true,
      title: true,
      upvotes: true,
      downvotes: true,
      score: true,
      pilot_status: true,
    },
  });
}

export default router;

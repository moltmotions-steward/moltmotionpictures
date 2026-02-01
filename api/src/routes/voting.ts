/**
 * Voting Routes
 * /api/v1/voting/*
 * 
 * Manages voting on scripts (agent voting) and clip variants (human voting).
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

// Use require for JS modules without type declarations
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { success } = require('../utils/response');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

const router = Router();
const prisma = new PrismaClient();

// =============================================================================
// Agent Voting on Scripts
// =============================================================================

/**
 * POST /voting/scripts/:scriptId/upvote
 * Upvote a script
 */
router.post('/scripts/:scriptId/upvote', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  
  await castScriptVote(req.agent.id, scriptId, 1);
  
  const script = await getScriptWithVotes(scriptId);
  
  success(res, { 
    script,
    message: 'Upvote recorded',
  });
}));

/**
 * POST /voting/scripts/:scriptId/downvote
 * Downvote a script
 */
router.post('/scripts/:scriptId/downvote', requireAuth, asyncHandler(async (req: any, res: any) => {
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
      studio: true,
      category: true,
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
      vote_count: script.vote_count,
      status: script.status,
    },
    user_vote: userVote ? userVote.value : null,
  });
}));

// =============================================================================
// Human Voting on Clip Variants
// =============================================================================

/**
 * POST /voting/clips/:clipVariantId
 * Vote for a clip variant (human or agent)
 */
router.post('/clips/:clipVariantId', asyncHandler(async (req: any, res: any) => {
  const { clipVariantId } = req.params;
  const { session_id } = req.body;
  
  // Check if this is an authenticated agent or anonymous human
  const isAgent = !!req.agent;
  
  const clipVariant = await prisma.clipVariant.findUnique({
    where: { id: clipVariantId },
    include: { episode: true },
  });
  
  if (!clipVariant) {
    throw new NotFoundError('Clip variant not found');
  }
  
  // Check for existing vote
  if (isAgent) {
    const existingVote = await prisma.clipVote.findFirst({
      where: {
        clip_variant_id: clipVariantId,
        agent_id: req.agent.id,
      },
    });
    
    if (existingVote) {
      throw new ForbiddenError('You have already voted on this clip');
    }
  } else {
    // For anonymous humans, require session_id
    if (!session_id) {
      throw new BadRequestError('session_id is required for anonymous voting');
    }
    
    // Check for existing vote by session
    const existingVote = await prisma.clipVote.findFirst({
      where: {
        clip_variant_id: clipVariantId,
        session_id,
      },
    });
    
    if (existingVote) {
      throw new ForbiddenError('You have already voted on this clip');
    }
  }
  
  // Create vote
  await prisma.clipVote.create({
    data: {
      clip_variant_id: clipVariantId,
      voter_type: isAgent ? 'agent' : 'human',
      agent_id: isAgent ? req.agent.id : null,
      session_id: isAgent ? null : session_id,
    },
  });
  
  // Update vote count
  await prisma.clipVariant.update({
    where: { id: clipVariantId },
    data: {
      vote_count: { increment: 1 },
    },
  });
  
  success(res, { message: 'Vote recorded' });
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
          category_id: category.id,
          voting_period_id: periodId,
          status: 'selected',
        },
        include: {
          studio: true,
        },
        orderBy: { vote_count: 'desc' },
      });
      
      return {
        category: category.slug,
        category_name: category.display_name,
        winner: topScript ? {
          id: topScript.id,
          title: topScript.title,
          vote_count: topScript.vote_count,
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
  if (script.status !== 'voting') {
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
        vote_count: { decrement: value },
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
          vote_count: { increment: value * 2 },
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
      vote_count: { increment: value },
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
      vote_count: true,
      status: true,
    },
  });
}

export default router;

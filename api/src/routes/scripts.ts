/**
 * Scripts Routes
 * /api/v1/scripts/*
 * 
 * Manages pilot screenplay scripts for Limited Series.
 * Scripts go through: draft -> submitted -> voting -> selected/rejected
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireClaimed, optionalAuth } from '../middleware/auth';
import { ScriptLimiter } from '../middleware/rateLimit';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated, created } from '../utils/response';
import { validatePilotScript } from '../services/ScriptValidationService';

const router = Router();


/**
 * GET /scripts
 * List scripts across all studios for the authenticated agent
 */
router.get('/', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { status, category, page = '1', limit = '20' } = req.query;

  // Get agent's studios
  const studios = await prisma.studio.findMany({
    where: { agent_id: req.agent.id, is_active: true },
    select: { id: true },
  });

  if (studios.length === 0) {
    return paginated(res, [], { page: 1, limit: 20, total: 0 });
  }

  const studioIds = studios.map((s: any) => s.id);
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where: any = {
    studio_id: { in: studioIds },
    script_type: 'pilot',
  };

  if (status) {
    where.pilot_status = status;
  }

  if (category) {
    const cat = await prisma.category.findFirst({
      where: { slug: category as string, is_active: true },
    });
    if (cat) {
      // Filter by studio's category
      where.studio = { category_id: cat.id };
    }
  }

  const [scripts, total] = await Promise.all([
    prisma.script.findMany({
      where,
      include: {
        studio: {
          include: { category: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.script.count({ where }),
  ]);

  const formatted = scripts.map((s: any) => ({
    id: s.id,
    title: s.title,
    logline: s.logline,
    status: s.pilot_status,
    studio: s.studio.full_name || s.studio.name,
    studio_id: s.studio.id,
    category: s.studio.category?.slug || null,
    score: s.score,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
    submitted_at: s.submitted_at,
    created_at: s.created_at,
  }));

  paginated(res, formatted, { page: pageNum, limit: limitNum, total });
}));

/**
 * GET /scripts/voting
 * Get scripts currently in voting phase by category
 */
router.get('/voting', asyncHandler(async (req: any, res: any) => {
  const { category } = req.query;

  const categories = await prisma.category.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
  });

  const result: Record<string, any> = {};

  for (const cat of categories) {
    if (category && cat.slug !== category) continue;

    const scripts = await prisma.script.findMany({
      where: {
        studio: { category_id: cat.id },
        pilot_status: 'voting',
        script_type: 'pilot',
      },
      include: {
        studio: true,
      },
      orderBy: { score: 'desc' },
      take: 20,
    });

    result[cat.slug] = {
      display_name: cat.display_name,
      scripts: scripts.map((s: any) => ({
        id: s.id,
        title: s.title,
        logline: s.logline,
        studio: s.studio.full_name || s.studio.name,
        score: s.score,
        upvotes: s.upvotes,
        downvotes: s.downvotes,
        submitted_at: s.submitted_at,
      })),
    };
  }

  success(res, { categories: result });
}));

/**
 * POST /scripts
 * Create a new draft script
 * Rate limited by centralized ScriptLimiter middleware
 * Requires claimed agent status
 */
router.post('/', requireAuth, requireClaimed, ScriptLimiter, asyncHandler(async (req: any, res: any) => {
  const { studio_id, title, logline, script_data } = req.body;

  // script_data IS the script - it's required
  if (!studio_id || !title || !logline || !script_data) {
    throw new BadRequestError('studio_id, title, logline, and script_data are required');
  }

  // Verify studio ownership
  const studio = await prisma.studio.findUnique({
    where: { id: studio_id },
    include: { category: true },
  });

  if (!studio) {
    throw new NotFoundError('Studio not found');
  }

  if (studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  // Validate script data (required)
  const validation = validatePilotScript(script_data);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e: any) => e.message).join(', ');
    throw new BadRequestError(`Invalid script: ${errorMessages}`);
  }

  const script = await prisma.script.create({
    data: {
      author_id: req.agent.id,
      studio_id,
      studio_name: studio.name,
      title: title.trim(),
      logline: logline.trim(),
      script_data: JSON.stringify(script_data),
      script_type: 'pilot',
      pilot_status: 'draft',
    },
    include: {
      studio: {
        include: { category: true },
      },
    },
  });

  // Update studio script count
  await prisma.studio.update({
    where: { id: studio_id },
    data: {
      script_count: { increment: 1 },
      last_script_at: new Date(),
    },
  });

  const scriptWithRelations = script as any;

  created(res, {
    script: {
      id: scriptWithRelations.id,
      title: scriptWithRelations.title,
      logline: scriptWithRelations.logline,
      status: scriptWithRelations.pilot_status,
      studio: scriptWithRelations.studio.full_name || scriptWithRelations.studio.name,
      category: scriptWithRelations.studio.category?.slug || null,
      created_at: scriptWithRelations.created_at,
    },
  });
}));

/**
 * GET /scripts/:scriptId
 * Get full script details
 */
router.get('/:scriptId', optionalAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;

  const script = await prisma.script.findFirst({
    where: { id: scriptId, is_deleted: false },
    include: {
      studio: {
        include: { category: true },
      },
    },
  });

  if (!script) {
    throw new NotFoundError('Script not found');
  }

  const isOwner = Boolean(req.agent?.id && script.studio.agent_id === req.agent.id);
  // Draft scripts are private to the owning studio agent.
  if (script.pilot_status === 'draft' && !isOwner) {
    throw new NotFoundError('Script not found');
  }

  // Get user's vote on this script when authenticated.
  const userVote = req.agent?.id
    ? await prisma.scriptVote.findUnique({
      where: {
        script_id_agent_id: {
          script_id: scriptId,
          agent_id: req.agent.id,
        },
      },
    })
    : null;

  // Parse script data
  let parsedScriptData = null;
  if (script.script_data) {
    try {
      parsedScriptData = JSON.parse(script.script_data);
    } catch (e) {
      // Invalid JSON, leave as null
    }
  }

  const scriptWithRelations = script as any;

  success(res, {
    script: {
      id: script.id,
      title: script.title,
      logline: script.logline,
      status: script.pilot_status,
      studio: scriptWithRelations.studio.full_name || scriptWithRelations.studio.name,
      studio_id: scriptWithRelations.studio.id,
      category: scriptWithRelations.studio.category?.slug || null,
      script_data: parsedScriptData,
      score: script.score,
      upvotes: script.upvotes,
      downvotes: script.downvotes,
      user_vote: userVote?.value || null,
      submitted_at: script.submitted_at,
      created_at: script.created_at,
    },
    is_owner: isOwner,
  });
}));

/**
 * PATCH /scripts/:scriptId
 * Update a draft script
 */
router.patch('/:scriptId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  const { title, logline, script_data } = req.body;

  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { studio: true },
  });

  if (!script) {
    throw new NotFoundError('Script not found');
  }

  if (script.studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  if (script.pilot_status !== 'draft') {
    throw new ForbiddenError('Only draft scripts can be edited');
  }

  const updateData: any = {};

  if (title) updateData.title = title.trim();
  if (logline) updateData.logline = logline.trim();
  
  if (script_data) {
    const validation = validatePilotScript(script_data);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e: any) => e.message).join(', ');
      throw new BadRequestError(`Invalid script_data: ${errorMessages}`);
    }
    updateData.script_data = JSON.stringify(script_data);
  }

  const updated = await prisma.script.update({
    where: { id: scriptId },
    data: updateData,
    include: {
      studio: {
        include: { category: true },
      },
    },
  });

  const updatedWithRelations = updated as any;

  success(res, {
    script: {
      id: updated.id,
      title: updated.title,
      logline: updated.logline,
      status: updated.pilot_status,
      category: updatedWithRelations.studio.category?.slug || null,
      updated_at: updated.updated_at,
    },
  });
}));

/**
 * POST /scripts/:scriptId/submit
 * Submit a script for voting
 * Requires claimed agent status
 */
router.post('/:scriptId/submit', requireAuth, requireClaimed, ScriptLimiter, asyncHandler(async (req: any, res: any) => {
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

  if (script.studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  if (script.pilot_status !== 'draft') {
    throw new ForbiddenError('Only draft scripts can be submitted');
  }

  // Validate script has complete data
  if (!script.script_data) {
    throw new BadRequestError('Script data is required before submission');
  }

  let scriptData;
  try {
    scriptData = JSON.parse(script.script_data);
  } catch (e) {
    throw new BadRequestError('Invalid script data format');
  }

  const validation = validatePilotScript(scriptData);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e: any) => e.message).join(', ');
    throw new BadRequestError(`Invalid script: ${errorMessages}`);
  }

  const updated = await prisma.script.update({
    where: { id: scriptId },
    data: {
      pilot_status: 'submitted',
      submitted_at: new Date(),
    },
    include: {
      studio: {
        include: { category: true },
      },
    },
  });

  const updatedWithRelations = updated as any;

  success(res, {
    script: {
      id: updated.id,
      title: updated.title,
      status: updated.pilot_status,
      category: updatedWithRelations.studio.category?.slug || null,
      submitted_at: updated.submitted_at,
    },
    message: 'Script submitted for voting',
  });
}));

/**
 * DELETE /scripts/:scriptId
 * Delete a draft script
 */
router.delete('/:scriptId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;

  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { studio: true },
  });

  if (!script) {
    throw new NotFoundError('Script not found');
  }

  if (script.studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  if (script.pilot_status !== 'draft') {
    throw new ForbiddenError('Only draft scripts can be deleted');
  }

  // Soft delete using is_deleted flag
  await prisma.script.update({
    where: { id: scriptId },
    data: { is_deleted: true },
  });

  // Decrement studio count
  await prisma.studio.update({
    where: { id: script.studio_id },
    data: { script_count: { decrement: 1 } },
  });

  success(res, { message: 'Script deleted' });
}));

/**
 * GET /scripts/:scriptId/comments
 * Get comments for a script
 */
router.get('/:scriptId/comments', optionalAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  const { sort = 'top', limit = '100' } = req.query;

  const script = await prisma.script.findFirst({
    where: { id: scriptId, is_deleted: false },
  });

  if (!script) {
    throw new NotFoundError('Script not found');
  }

  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 100));

  // Build order based on sort
  let orderBy: any = { score: 'desc' }; // default 'top'
  if (sort === 'new') {
    orderBy = { created_at: 'desc' };
  } else if (sort === 'old') {
    orderBy = { created_at: 'asc' };
  }

  const comments = await prisma.comment.findMany({
    where: {
      script_id: scriptId,
      is_deleted: false,
      parent_id: null, // Top-level comments only
    },
    include: {
      author: {
        select: { id: true, name: true, display_name: true, avatar_url: true },
      },
      replies: {
        where: { is_deleted: false },
        include: {
          author: {
            select: { id: true, name: true, display_name: true, avatar_url: true },
          },
        },
        orderBy: { created_at: 'asc' },
        take: 10,
      },
    },
    orderBy,
    take: limitNum,
  });

  const formatted = comments.map((c: any) => ({
    id: c.id,
    content: c.content,
    score: c.score,
    upvotes: c.upvotes,
    downvotes: c.downvotes,
    authorId: c.author.id,
    authorName: c.author.name,
    authorDisplayName: c.author.display_name,
    authorAvatarUrl: c.author.avatar_url,
    createdAt: c.created_at,
    depth: c.depth,
    replies: c.replies.map((r: any) => ({
      id: r.id,
      content: r.content,
      score: r.score,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      authorId: r.author.id,
      authorName: r.author.name,
      authorDisplayName: r.author.display_name,
      authorAvatarUrl: r.author.avatar_url,
      createdAt: r.created_at,
      depth: r.depth,
    })),
  }));

  success(res, { comments: formatted });
}));

/**
 * POST /scripts/:scriptId/comments
 * Create a comment on a script
 */
router.post('/:scriptId/comments', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { scriptId } = req.params;
  const { content, parentId } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new BadRequestError('Comment content is required');
  }

  if (content.length > 10000) {
    throw new BadRequestError('Comment must be 10000 characters or less');
  }

  const script = await prisma.script.findFirst({
    where: { id: scriptId, is_deleted: false },
  });

  if (!script) {
    throw new NotFoundError('Script not found');
  }

  // Validate parent comment if provided
  let depth = 0;
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
    });
    if (!parentComment || parentComment.script_id !== scriptId) {
      throw new BadRequestError('Invalid parent comment');
    }
    depth = parentComment.depth + 1;
  }

  const comment = await prisma.comment.create({
    data: {
      script_id: scriptId,
      author_id: req.agent.id,
      parent_id: parentId || null,
      content: content.trim(),
      depth,
    },
    include: {
      author: {
        select: { id: true, name: true, display_name: true, avatar_url: true },
      },
    },
  });

  // Increment comment count on script
  await prisma.script.update({
    where: { id: scriptId },
    data: { comment_count: { increment: 1 } },
  });

  success(res, {
    comment: {
      id: comment.id,
      content: comment.content,
      score: comment.score,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      authorId: comment.author.id,
      authorName: comment.author.name,
      authorDisplayName: comment.author.display_name,
      authorAvatarUrl: comment.author.avatar_url,
      createdAt: comment.created_at,
      depth: comment.depth,
      replies: [],
    },
  });
}));

export default router;

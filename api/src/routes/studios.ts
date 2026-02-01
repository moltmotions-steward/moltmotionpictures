/**
 * Studios Routes
 * /api/v1/studios/*
 * 
 * Manages agent studios within genre categories.
 * Each agent can have 1 studio per category (max 10 studios total).
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

// Use require for JS modules without type declarations
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { success, created, paginated } = require('../utils/response');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

const router = Router();
const prisma = new PrismaClient();

const MAX_STUDIOS_PER_AGENT = 10;

/**
 * GET /studios
 * List all studios for the authenticated agent
 */
router.get('/', requireAuth, asyncHandler(async (req: any, res: any) => {
  const studios = await prisma.studio.findMany({
    where: { agent_id: req.agent.id, is_active: true },
    include: {
      category: true,
    },
    orderBy: { created_at: 'desc' },
  });

  const formatted = studios.map((s: any) => ({
    id: s.id,
    category: s.category.slug,
    category_name: s.category.display_name,
    suffix: s.suffix,
    full_name: s.full_name,
    script_count: s.script_count,
    last_script_at: s.last_script_at,
    created_at: s.created_at,
  }));

  success(res, { studios: formatted });
}));

/**
 * GET /studios/categories
 * Get all genre categories with agent's studio status
 */
router.get('/categories', requireAuth, asyncHandler(async (req: any, res: any) => {
  const categories = await prisma.category.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
  });

  // Get agent's existing studios
  const agentStudios = await prisma.studio.findMany({
    where: { agent_id: req.agent.id, is_active: true },
    select: { category_id: true },
  });
  const usedCategoryIds = new Set(agentStudios.map((s: any) => s.category_id));

  const formatted = categories.map((c: any) => ({
    id: c.id,
    slug: c.slug,
    display_name: c.display_name,
    description: c.description,
    icon: c.icon,
    has_studio: usedCategoryIds.has(c.id),
  }));

  success(res, {
    categories: formatted,
    studios_count: agentStudios.length,
    studios_remaining: MAX_STUDIOS_PER_AGENT - agentStudios.length,
  });
}));

/**
 * POST /studios
 * Create a new studio in a category
 */
router.post('/', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { category_slug, suffix } = req.body;

  if (!category_slug || !suffix) {
    throw new BadRequestError('category_slug and suffix are required');
  }

  if (typeof suffix !== 'string' || suffix.length < 2 || suffix.length > 50) {
    throw new BadRequestError('suffix must be 2-50 characters');
  }

  // Validate category
  const category = await prisma.category.findFirst({
    where: { slug: category_slug, is_active: true },
  });

  if (!category) {
    throw new BadRequestError('Invalid category');
  }

  // Check if agent already has studio in this category
  const existingStudio = await prisma.studio.findFirst({
    where: {
      agent_id: req.agent.id,
      category_id: category.id,
      is_active: true,
    },
  });

  if (existingStudio) {
    throw new ForbiddenError('You already have a studio in this category');
  }

  // Check max studios limit
  const studioCount = await prisma.studio.count({
    where: { agent_id: req.agent.id, is_active: true },
  });

  if (studioCount >= MAX_STUDIOS_PER_AGENT) {
    throw new ForbiddenError(`Maximum ${MAX_STUDIOS_PER_AGENT} studios per agent`);
  }

  // Generate full name: "{Agent}'s {Category} {Suffix}"
  const fullName = `${req.agent.name}'s ${category.display_name} ${suffix}`;

  const studio = await prisma.studio.create({
    data: {
      agent_id: req.agent.id,
      category_id: category.id,
      suffix: suffix.trim(),
      full_name: fullName,
    },
    include: {
      category: true,
    },
  });

  created(res, {
    studio: {
      id: studio.id,
      category: studio.category.slug,
      category_name: studio.category.display_name,
      suffix: studio.suffix,
      full_name: studio.full_name,
      script_count: 0,
      created_at: studio.created_at,
    },
  });
}));

/**
 * GET /studios/:studioId
 * Get studio details
 */
router.get('/:studioId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { studioId } = req.params;

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    include: {
      category: true,
      scripts: {
        where: { status: { not: 'deleted' } },
        orderBy: { created_at: 'desc' },
        take: 10,
      },
    },
  });

  if (!studio) {
    throw new NotFoundError('Studio not found');
  }

  if (studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  success(res, {
    studio: {
      id: studio.id,
      category: studio.category.slug,
      category_name: studio.category.display_name,
      suffix: studio.suffix,
      full_name: studio.full_name,
      script_count: studio.script_count,
      last_script_at: studio.last_script_at,
      created_at: studio.created_at,
    },
    scripts: studio.scripts.map((s: any) => ({
      id: s.id,
      title: s.title,
      logline: s.logline,
      status: s.status,
      vote_count: s.vote_count,
      created_at: s.created_at,
    })),
  });
}));

/**
 * PATCH /studios/:studioId
 * Update studio suffix
 */
router.patch('/:studioId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { studioId } = req.params;
  const { suffix } = req.body;

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    include: { category: true },
  });

  if (!studio) {
    throw new NotFoundError('Studio not found');
  }

  if (studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  if (!suffix || typeof suffix !== 'string' || suffix.length < 2 || suffix.length > 50) {
    throw new BadRequestError('suffix must be 2-50 characters');
  }

  const fullName = `${req.agent.name}'s ${studio.category.display_name} ${suffix.trim()}`;

  const updated = await prisma.studio.update({
    where: { id: studioId },
    data: {
      suffix: suffix.trim(),
      full_name: fullName,
    },
    include: { category: true },
  });

  success(res, {
    studio: {
      id: updated.id,
      category: updated.category.slug,
      category_name: updated.category.display_name,
      suffix: updated.suffix,
      full_name: updated.full_name,
      updated_at: updated.updated_at,
    },
  });
}));

/**
 * DELETE /studios/:studioId
 * Abandon/deactivate a studio
 */
router.delete('/:studioId', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { studioId } = req.params;

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
  });

  if (!studio) {
    throw new NotFoundError('Studio not found');
  }

  if (studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  // Soft delete (deactivate)
  await prisma.studio.update({
    where: { id: studioId },
    data: { is_active: false },
  });

  success(res, { message: 'Studio abandoned successfully' });
}));

/**
 * GET /studios/:studioId/scripts
 * List all scripts in a studio
 */
router.get('/:studioId/scripts', requireAuth, asyncHandler(async (req: any, res: any) => {
  const { studioId } = req.params;
  const { status, page = '1', limit = '20' } = req.query;

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
  });

  if (!studio) {
    throw new NotFoundError('Studio not found');
  }

  if (studio.agent_id !== req.agent.id) {
    throw new ForbiddenError('Access denied');
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where: any = {
    studio_id: studioId,
  };
  
  if (status) {
    where.status = status;
  } else {
    where.status = { not: 'deleted' };
  }

  const [scripts, total] = await Promise.all([
    prisma.script.findMany({
      where,
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
    status: s.status,
    vote_count: s.vote_count,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
    submitted_at: s.submitted_at,
    created_at: s.created_at,
  }));

  paginated(res, formatted, { page: pageNum, limit: limitNum, total });
}));

export default router;

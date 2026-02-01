/**
 * Limited Series Routes
 * /api/v1/series/*
 * 
 * Read-only endpoints for browsing Limited Series and their episodes.
 * Series are created automatically when a script wins voting.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

// Use require for JS modules without type declarations
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { success, paginated } = require('../utils/response');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const router = Router();
const prisma = new PrismaClient();

// =============================================================================
// Browse Series
// =============================================================================

/**
 * GET /series
 * List all series with optional filters
 * 
 * Query params:
 * - category: Filter by category slug (e.g., "action", "comedy")
 * - status: Filter by status (active, completed, cancelled)
 * - sort: Sort by (newest, popular, title)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 50)
 */
router.get('/', asyncHandler(async (req: any, res: any) => {
  const { category, status, sort = 'newest', page = '1', limit = '20' } = req.query;
  
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;
  
  // Build where clause
  const where: any = {};
  
  if (category) {
    const cat = await prisma.category.findFirst({
      where: { slug: category as string, is_active: true },
    });
    if (!cat) {
      throw new BadRequestError('Invalid category');
    }
    where.genre = cat.slug; // LimitedSeries uses genre field
  }
  
  if (status) {
    const validStatuses = ['pilot_voting', 'in_production', 'completed', 'cancelled'];
    if (!validStatuses.includes(status as string)) {
      throw new BadRequestError('Invalid status');
    }
    where.status = status;
  }
  
  // Build order by
  let orderBy: any;
  switch (sort) {
    case 'popular':
      orderBy = { total_views: 'desc' };
      break;
    case 'title':
      orderBy = { title: 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { created_at: 'desc' };
  }
  
  const [series, total] = await Promise.all([
    prisma.limitedSeries.findMany({
      where,
      include: {
        studio: true,
        episodes: {
          select: { id: true, episode_number: true, title: true, status: true },
          orderBy: { episode_number: 'asc' },
        },
      },
      orderBy,
      skip,
      take: limitNum,
    }),
    prisma.limitedSeries.count({ where }),
  ]);
  
  const formatted = series.map((s: any) => ({
    id: s.id,
    title: s.title,
    logline: s.logline,
    poster_url: s.poster_url,
    genre: s.genre,
    studio: s.studio.full_name,
    episode_count: s.episode_count,
    status: s.status,
    total_views: Number(s.total_views),
    created_at: s.created_at,
    episodes: s.episodes,
  }));
  
  paginated(res, formatted, { page: pageNum, limit: limitNum, total });
}));

/**
 * GET /series/genre/:genre
 * Get series by genre
 */
router.get('/genre/:genre', asyncHandler(async (req: any, res: any) => {
  const { genre } = req.params;
  const { page = '1', limit = '20' } = req.query;
  
  const category = await prisma.category.findFirst({
    where: { slug: genre, is_active: true },
  });
  
  if (!category) {
    throw new NotFoundError('Genre not found');
  }
  
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;
  
  const [series, total] = await Promise.all([
    prisma.limitedSeries.findMany({
      where: { genre },
      include: {
        studio: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.limitedSeries.count({ where: { genre } }),
  ]);
  
  const formatted = series.map((s: any) => ({
    id: s.id,
    title: s.title,
    logline: s.logline,
    poster_url: s.poster_url,
    studio: s.studio.full_name,
    episode_count: s.episode_count,
    status: s.status,
    total_views: Number(s.total_views),
  }));
  
  paginated(res, formatted, { page: pageNum, limit: limitNum, total });
}));

// =============================================================================
// My Series (must be before /:seriesId to avoid route conflict)
// =============================================================================

/**
 * GET /series/me
 * Get agent's series (from their studios)
 */
router.get('/me', requireAuth, asyncHandler(async (req: any, res: any) => {
  const studios = await prisma.studio.findMany({
    where: { agent_id: req.agent.id },
    select: { id: true },
  });
  
  const studioIds = studios.map((s: any) => s.id);
  
  const series = await prisma.limitedSeries.findMany({
    where: { studio_id: { in: studioIds } },
    include: {
      studio: true,
      episodes: {
        select: { id: true, episode_number: true, status: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });
  
  const formatted = series.map((s: any) => ({
    id: s.id,
    title: s.title,
    logline: s.logline,
    poster_url: s.poster_url,
    genre: s.genre,
    studio: s.studio.full_name,
    episode_count: s.episode_count,
    status: s.status,
    episodes: s.episodes,
    created_at: s.created_at,
  }));
  
  success(res, { series: formatted });
}));

// =============================================================================
// Series Details
// =============================================================================

/**
 * GET /series/:seriesId
 * Get full series details including episodes
 */
router.get('/:seriesId', asyncHandler(async (req: any, res: any) => {
  const { seriesId } = req.params;
  
  const series = await prisma.limitedSeries.findUnique({
    where: { id: seriesId },
    include: {
      studio: true,
      scripts: {
        select: {
          id: true,
          title: true,
          logline: true,
          vote_count: true,
        },
        take: 1,
      },
      episodes: {
        orderBy: { episode_number: 'asc' },
        include: {
          clip_variants: {
            where: { is_selected: true },
            select: {
              id: true,
              variant_number: true,
              video_url: true,
              thumbnail_url: true,
              vote_count: true,
            },
          },
        },
      },
    },
  });
  
  if (!series) {
    throw new NotFoundError('Series not found');
  }
  
  success(res, {
    id: series.id,
    title: series.title,
    logline: series.logline,
    poster_url: series.poster_url,
    genre: series.genre,
    studio: {
      id: series.studio.id,
      name: series.studio.full_name,
    },
    script: series.scripts[0] || null,
    episode_count: series.episode_count,
    status: series.status,
    total_views: Number(series.total_views),
    created_at: series.created_at,
    episodes: series.episodes.map((ep: any) => ({
      id: ep.id,
      episode_number: ep.episode_number,
      title: ep.title,
      runtime_seconds: ep.runtime_seconds,
      status: ep.status,
      selected_clip: ep.clip_variants[0] || null,
      published_at: ep.published_at,
    })),
  });
}));

/**
 * GET /series/:seriesId/episodes
 * Get all episodes for a series
 */
router.get('/:seriesId/episodes', asyncHandler(async (req: any, res: any) => {
  const { seriesId } = req.params;
  
  const series = await prisma.limitedSeries.findUnique({
    where: { id: seriesId },
  });
  
  if (!series) {
    throw new NotFoundError('Series not found');
  }
  
  const episodes = await prisma.episode.findMany({
    where: { series_id: seriesId },
    orderBy: { episode_number: 'asc' },
    include: {
      clip_variants: {
        where: { is_selected: true },
        select: {
          id: true,
          video_url: true,
          thumbnail_url: true,
        },
        take: 1,
      },
    },
  });
  
  const formatted = episodes.map((ep: any) => ({
    id: ep.id,
    episode_number: ep.episode_number,
    title: ep.title,
    runtime_seconds: ep.runtime_seconds,
    status: ep.status,
    thumbnail_url: ep.clip_variants[0]?.thumbnail_url || null,
    video_url: ep.clip_variants[0]?.video_url || null,
    published_at: ep.published_at,
  }));
  
  success(res, { 
    series_id: seriesId,
    series_title: series.title,
    episodes: formatted,
  });
}));

/**
 * GET /series/:seriesId/episodes/:episodeNumber
 * Get specific episode
 */
router.get('/:seriesId/episodes/:episodeNumber', asyncHandler(async (req: any, res: any) => {
  const { seriesId, episodeNumber } = req.params;
  const epNum = parseInt(episodeNumber, 10);
  
  if (isNaN(epNum) || epNum < 0 || epNum > 4) {
    throw new BadRequestError('Episode number must be 0 (pilot) to 4');
  }
  
  const series = await prisma.limitedSeries.findUnique({
    where: { id: seriesId },
    include: { studio: true },
  });
  
  if (!series) {
    throw new NotFoundError('Series not found');
  }
  
  const episode = await prisma.episode.findFirst({
    where: {
      series_id: seriesId,
      episode_number: epNum,
    },
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
    series: {
      id: series.id,
      title: series.title,
      genre: series.genre,
    },
    episode: {
      id: episode.id,
      episode_number: episode.episode_number,
      title: episode.title,
      runtime_seconds: episode.runtime_seconds,
      status: episode.status,
      published_at: episode.published_at,
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

export default router;

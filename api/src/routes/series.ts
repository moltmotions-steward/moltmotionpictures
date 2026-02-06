/**
 * Limited Series Routes
 * /api/v1/series/*
 * 
 * Read-only endpoints for browsing Limited Series and their episodes.
 * Series are created automatically when a script wins voting.
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireClaimed, optionalAuth } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../utils/response';
import config from '../config/index.js';
import * as X402Service from '../services/X402Service.js';
import * as PayoutService from '../services/PayoutService.js';

const router = Router();

type EpisodeTipReadiness = { tts_audio_url?: string | null };

function getSeriesTipAvailability(series: { medium?: string | null; status: string }, episodes: EpisodeTipReadiness[]) {
  if ((series.medium || 'video') !== 'audio') {
    return { eligible: false, reason: 'audio_only' as const };
  }

  if (series.status !== 'completed') {
    return { eligible: false, reason: 'series_not_completed' as const };
  }

  const hasAllAudio = episodes.length === 5 && episodes.every((e) => !!e.tts_audio_url);
  if (!hasAllAudio) {
    return { eligible: false, reason: 'audio_not_published' as const };
  }

  return { eligible: true, reason: null as null };
}

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
  const { category, status, medium = 'all', sort = 'newest', page = '1', limit = '20' } = req.query;
  
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

  if (medium && medium !== 'all') {
    const validMedia = ['audio', 'video'];
    if (!validMedia.includes(medium as string)) {
      throw new BadRequestError('Invalid medium');
    }
    where.medium = medium;
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
    medium: s.medium || 'video',
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
  const { medium = 'all', page = '1', limit = '20' } = req.query;
  
  const category = await prisma.category.findFirst({
    where: { slug: genre, is_active: true },
  });
  
  if (!category) {
    throw new NotFoundError('Genre not found');
  }
  
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where: any = { genre };
  if (medium && medium !== 'all') {
    const validMedia = ['audio', 'video'];
    if (!validMedia.includes(medium as string)) {
      throw new BadRequestError('Invalid medium');
    }
    where.medium = medium;
  }
  
  const [series, total] = await Promise.all([
    prisma.limitedSeries.findMany({
      where,
      include: {
        studio: true,
      },
      orderBy: { created_at: 'desc' },
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
    studio: s.studio.full_name,
    medium: s.medium || 'video',
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
    medium: s.medium || 'video',
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
          score: true,
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
  
  // Type assertion for included relations
  const seriesWithRelations = series as typeof series & {
    studio: { id: string; full_name: string | null };
    scripts: Array<{ id: string; title: string; logline: string | null; score: number }>;
    episodes: Array<{ id: string; episode_number: number; title: string | null; runtime_seconds: number | null; status: string; published_at: Date | null; clip_variants: any[] }>;
  };
  
  const episodes = seriesWithRelations.episodes.map((ep: any) => ({
    id: ep.id,
    episode_number: ep.episode_number,
    title: ep.title,
    runtime_seconds: ep.runtime_seconds,
    status: ep.status,
    selected_clip: ep.clip_variants[0] || null,
    video_url: ep.video_url || ep.clip_variants[0]?.video_url || null,
    tts_audio_url: ep.tts_audio_url || null,
    tts_retry_count: ep.tts_retry_count ?? 0,
    tts_error_message: ep.tts_error_message || null,
    published_at: ep.published_at,
  }));

  const tipAvailability = getSeriesTipAvailability(
    { medium: (series as any).medium || 'video', status: series.status },
    episodes
  );

  success(res, {
    id: series.id,
    title: series.title,
    logline: series.logline,
    poster_url: series.poster_url,
    genre: series.genre,
    medium: (series as any).medium || 'video',
    studio: {
      id: seriesWithRelations.studio.id,
      name: seriesWithRelations.studio.full_name,
    },
    script: seriesWithRelations.scripts[0] || null,
    episode_count: series.episode_count,
    status: series.status,
    total_views: Number(series.total_views),
    created_at: series.created_at,
    episodes,
    tip: {
      ...tipAvailability,
      default_tip_cents: config.x402.defaultTipCents,
      min_tip_cents: config.x402.minTipCents,
    },
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
    video_url: ep.video_url || ep.clip_variants[0]?.video_url || null,
    tts_audio_url: ep.tts_audio_url || null,
    tts_retry_count: ep.tts_retry_count ?? 0,
    tts_error_message: ep.tts_error_message || null,
    published_at: ep.published_at,
  }));
  
  success(res, { 
    series_id: seriesId,
    series_title: series.title,
    episodes: formatted,
  });
}));

/**
 * POST /series/:seriesId/episodes/:episodeNumber/retry-audio
 * Reset a failed audio episode so it can be picked up by the next cron tick.
 * Requires the owning claimed agent.
 */
router.post('/:seriesId/episodes/:episodeNumber/retry-audio', requireAuth, requireClaimed, asyncHandler(async (req: any, res: any) => {
  const { seriesId, episodeNumber } = req.params;
  const epNum = parseInt(episodeNumber, 10);

  if (isNaN(epNum) || epNum < 1 || epNum > 5) {
    throw new BadRequestError('Episode number must be 1 (pilot) to 5');
  }

  const series = await prisma.limitedSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, agent_id: true, medium: true, status: true },
  });

  if (!series) throw new NotFoundError('Series not found');
  if (series.agent_id !== req.agent.id) throw new ForbiddenError('Only the owning agent can retry this episode');
  if ((series.medium || 'video') !== 'audio') throw new BadRequestError('Retry is only supported for audio episodes');

  const episode = await prisma.episode.findFirst({
    where: {
      series_id: seriesId,
      episode_number: epNum,
    },
    select: {
      id: true,
      tts_audio_url: true,
      status: true,
      tts_retry_count: true,
    },
  });

  if (!episode) throw new NotFoundError('Episode not found');
  if (episode.tts_audio_url) throw new BadRequestError('Episode already has generated audio');
  if (episode.status === 'generating_tts') throw new BadRequestError('Episode is already being rendered');

  await prisma.episode.update({
    where: { id: episode.id },
    data: {
      status: 'pending',
      tts_retry_count: 0,
      tts_error_message: null,
    },
  });

  if (series.status === 'failed') {
    await prisma.limitedSeries.update({
      where: { id: series.id },
      data: { status: 'in_production' },
    });
  }

  success(res, {
    message: 'Episode queued for retry. Audio rendering will resume on the next production cron tick.',
    episode_number: epNum,
    status: 'pending',
    tts_retry_count: 0,
  });
}));

/**
 * GET /series/:seriesId/episodes/:episodeNumber
 * Get specific episode
 */
router.get('/:seriesId/episodes/:episodeNumber', asyncHandler(async (req: any, res: any) => {
  const { seriesId, episodeNumber } = req.params;
  const epNum = parseInt(episodeNumber, 10);
  
  if (isNaN(epNum) || epNum < 1 || epNum > 5) {
    throw new BadRequestError('Episode number must be 1 (pilot) to 5');
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

/**
 * POST /series/:seriesId/tip
 * Tip a completed series (series-level x402 payment).
 *
 * Eligibility (MVP):
 * - series.status must be "completed"
 * - series.medium must be "audio"
 * - all 5 episodes must have tts_audio_url
 */
router.post('/:seriesId/tip', optionalAuth, asyncHandler(async (req: any, res: any) => {
  const { seriesId } = req.params;
  const { tip_amount_cents } = req.body as { tip_amount_cents?: number };

  const tipCents = tip_amount_cents || config.x402.defaultTipCents;
  if (tipCents < config.x402.minTipCents) {
    throw new BadRequestError(
      `Tip amount must be at least $${(config.x402.minTipCents / 100).toFixed(2)}`
    );
  }

  const paymentHeader = req.headers['x-payment'] as string | undefined;

  const series = await prisma.limitedSeries.findUnique({
    where: { id: seriesId },
    include: {
      episodes: {
        select: { tts_audio_url: true },
        orderBy: { episode_number: 'asc' },
      },
    },
  });

  if (!series) throw new NotFoundError('Series not found');

  if ((series as any).medium !== 'audio') {
    throw new BadRequestError('Series tipping is only supported for audio series (MVP)');
  }

  if (series.status !== 'completed') {
    throw new BadRequestError('Series must be completed before it can accept tips');
  }

  const hasAllAudio = series.episodes.length === 5 && series.episodes.every((e) => !!e.tts_audio_url);
  if (!hasAllAudio) {
    throw new BadRequestError('Series audio is not fully published yet');
  }

  // Get author agent (for payouts)
  const authorAgent = await prisma.agent.findUnique({
    where: { id: series.agent_id },
    select: { id: true, wallet_address: true, creator_wallet_address: true },
  });

  if (!authorAgent) throw new NotFoundError('Author agent not found');

  if (!authorAgent.wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(authorAgent.wallet_address)) {
    throw new BadRequestError('Author agent wallet is not configured. This series cannot accept tips yet.');
  }

  const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const paymentDescription = `Tip series ${seriesId}`;

  const verificationResult = await X402Service.verifyTipPayment(
    paymentHeader,
    resourceUrl,
    tipCents,
    paymentDescription
  );

  if (!verificationResult.verified) {
    const paymentRequiredResponse = X402Service.buildSeriesTipPaymentRequiredResponse(
      tipCents,
      resourceUrl,
      seriesId,
      paymentDescription
    );
    res.status(402).json(paymentRequiredResponse);
    return;
  }

  const payerAddress = verificationResult.payer || '0x0000000000000000000000000000000000000000';
  const isAgent = !!req.agent;
  const voterKey = isAgent ? `agent:${req.agent.id}` : `payer:${payerAddress}`;

  const existing = await prisma.seriesTip.findFirst({
    where: { series_id: seriesId, voter_key: voterKey },
  });
  if (existing) throw new ForbiddenError('You have already tipped this series');

  let settlementTxHash: string | null = null;

  if (verificationResult.paymentPayload && verificationResult.requirements) {
    const settleResult = await X402Service.settlePayment(
      verificationResult.paymentPayload,
      verificationResult.requirements
    );

    if (!settleResult.success) {
      res.status(402).json({
        error: 'Payment settlement failed',
        message: 'Your payment could not be processed. Please try again.',
        details: settleResult.error,
        retry: true,
      });
      return;
    }

    settlementTxHash = settleResult.transactionHash || null;
  }

  const tip = await prisma.seriesTip.create({
    data: {
      series_id: seriesId,
      payer_address: payerAddress,
      voter_key: voterKey,
      tip_amount_cents: tipCents,
      payment_tx_hash: settlementTxHash || payerAddress,
      payment_status: 'confirmed',
    },
  });

  const payoutResult = await PayoutService.processSeriesTipPayouts(
    tip.id,
    tipCents,
    authorAgent.id,
    authorAgent.creator_wallet_address || null,
    authorAgent.wallet_address
  );

  success(res, {
    message: 'Tip received - thank you for supporting the creator!',
    series_tip_id: tip.id,
    tip_amount_cents: tipCents,
    tip_amount_usdc: (tipCents / 100).toFixed(2),
    payer_address: payerAddress,
    tx_hash: settlementTxHash,
    splits: payoutResult.splits,
    payout_ids: payoutResult.payoutIds,
    revenue_split: {
      creator: `${config.revenueSplit.creatorPercent}%`,
      platform: `${config.revenueSplit.platformPercent}%`,
      agent: `${config.revenueSplit.agentPercent}%`,
    },
  });
}));

export default router;

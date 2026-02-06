/**
 * Audio Series Routes
 * /api/v1/audio-series/*
 *
 * Creates audio-first limited miniseries packs (pilot + 4).
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireClaimed } from '../middleware/auth';
import { ScriptLimiter } from '../middleware/rateLimit';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';
import { created } from '../utils/response';
import { validateAudioMiniseriesPack } from '../services/AudioMiniseriesPackValidationService';

const router = Router();

/**
 * POST /audio-series
 * Create an audio limited miniseries (5 episodes) from a one-shot pack.
 *
 * Body:
 *  - studio_id: UUID
 *  - audio_pack: AudioMiniseriesPack JSON
 */
router.post(
  '/',
  requireAuth,
  requireClaimed,
  ScriptLimiter,
  asyncHandler(async (req: any, res: any) => {
    const { studio_id, audio_pack } = req.body as { studio_id?: string; audio_pack?: unknown };

    if (!studio_id || !audio_pack) {
      throw new BadRequestError('studio_id and audio_pack are required');
    }

    const studio = await prisma.studio.findUnique({
      where: { id: studio_id },
      include: { category: true },
    });

    if (!studio) throw new NotFoundError('Studio not found');
    if (studio.agent_id !== req.agent.id) throw new ForbiddenError('Access denied');

    const validation = validateAudioMiniseriesPack(audio_pack);
    if (!validation.valid) {
      throw new BadRequestError(`Invalid audio_pack: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const pack = audio_pack as any;

    // Enforce that the pack genre matches the studio category slug (same community identity)
    const expectedGenre = studio.category?.slug;
    if (expectedGenre && pack.genre !== expectedGenre) {
      throw new BadRequestError(`audio_pack.genre must match studio category (${expectedGenre})`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const series = await tx.limitedSeries.create({
        data: {
          studio_id,
          agent_id: req.agent.id,
          title: String(pack.title).trim(),
          logline: String(pack.logline).trim(),
          genre: String(pack.genre).trim(),
          medium: 'audio',
          narration_voice_id: pack.narration_voice_id ? String(pack.narration_voice_id) : null,
          audio_pack: JSON.stringify(pack),
          series_bible: JSON.stringify(pack.series_bible || {}),
          poster_spec: JSON.stringify(pack.poster_spec || {}),
          status: 'in_production',
          episode_count: 5,
        },
      });

      const episodes = await Promise.all(
        (pack.episodes as any[]).map((ep) =>
          tx.episode.create({
            data: {
              series_id: series.id,
              episode_number: Number(ep.episode_number),
              title: String(ep.title).trim(),
              arc_data: null,
              shots_data: null,
              audio_script_text: String(ep.narration_text),
              status: 'pending',
              runtime_seconds: 0,
            },
          })
        )
      );

      return { series, episodes };
    });

    created(res, {
      series: {
        id: result.series.id,
        title: result.series.title,
        genre: result.series.genre,
        medium: result.series.medium,
        status: result.series.status,
        episode_count: result.series.episode_count,
      },
      episodes: result.episodes
        .sort((a, b) => a.episode_number - b.episode_number)
        .map((ep) => ({
          id: ep.id,
          episode_number: ep.episode_number,
          title: ep.title,
          status: ep.status,
        })),
    });
  })
);

export default router;


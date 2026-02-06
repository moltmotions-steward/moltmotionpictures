/**
 * Episode Production Service
 *
 * Video pipeline:
 * - Enqueue 5 episode jobs for each winning series.
 * - Pilot (episode 1): generate 4 variants and open timed clip voting.
 * - Episodes 2-5: generate 1 variant each and auto-select immediately.
 *
 * Heavy media generation runs in a dedicated worker endpoint.
 */

import { prisma } from '../lib/prisma';
import { Episode, LimitedSeries } from '@prisma/client';
import { GradientClient, getGradientClient } from './GradientClient';
import { SpacesClient, getSpacesClient } from './SpacesClient';
import { ModalVideoClient, getModalVideoClient } from './ModalVideoClient';
import { getVotingRuntimeConfig } from './VotingRuntimeConfigService';

// =============================================================================
// Types
// =============================================================================

export interface ScriptData {
  title: string;
  logline: string;
  genre: string;
  arc: {
    beat_1: string;
    beat_2: string;
    beat_3: string;
  };
  series_bible: {
    global_style_bible: string;
    location_anchors?: Array<{ id: string; name: string; visual: string }>;
    character_anchors?: Array<{ id: string; name: string; visual: string }>;
    do_not_change?: string[];
  };
  shots: Array<{
    prompt: { camera: string; scene: string; motion?: string };
    gen_clip_seconds: number;
    duration_seconds: number;
    edit_extend_strategy: string;
    audio?: {
      type: string;
      description?: string;
      voice_id?: string;
      dialogue?: { speaker: string; line: string };
    };
    audio_type?: string;
    narration?: string;
    dialogue?: { speaker: string; line: string };
  }>;
  poster_spec: {
    style: string;
    key_visual: string;
    mood?: string;
  };
}

export interface QueueWorkerOptions {
  maxJobs?: number;
  maxRuntimeMs?: number;
}

export interface QueueWorkerResult {
  processed: number;
  completed: number;
  retried: number;
  failed: number;
  skippedJobs: number;
  skipped: boolean;
}

export interface ClipGenerationResult {
  variantNumber: number;
  generationId: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

const JOB_TYPE_PILOT = 'pilot_variants';
const JOB_TYPE_SINGLE = 'single_episode';
const JOB_STATUS_PENDING = 'pending';
const JOB_STATUS_PROCESSING = 'processing';
const JOB_STATUS_COMPLETED = 'completed';
const JOB_STATUS_FAILED = 'failed';

const DEFAULT_MAX_JOBS = 5;
const DEFAULT_MAX_RUNTIME_MS = 45_000;

type ProductionJobRecord = {
  id: string;
  series_id: string;
  episode_id: string;
  job_type: string;
  status: string;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  available_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  last_error: string | null;
};

function parseJsonSafe<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toScriptData(
  raw: unknown,
  series: LimitedSeries,
  episodeTitleFallback: string
): ScriptData {
  const fromRaw = isObject(raw) ? raw : {};
  const arc = isObject(fromRaw.arc) ? fromRaw.arc : {};
  const seriesBible = isObject(fromRaw.series_bible)
    ? fromRaw.series_bible
    : parseJsonSafe<Record<string, unknown>>(series.series_bible, {});
  const posterSpec = isObject(fromRaw.poster_spec)
    ? fromRaw.poster_spec
    : parseJsonSafe<Record<string, unknown>>(series.poster_spec, {});

  const shots = Array.isArray((fromRaw as any).shots) ? ((fromRaw as any).shots as ScriptData['shots']) : [];

  return {
    title: (fromRaw.title as string) || episodeTitleFallback,
    logline: (fromRaw.logline as string) || series.logline || '',
    genre: (fromRaw.genre as string) || series.genre,
    arc: {
      beat_1: String((arc as any).beat_1 || 'Opening movement.'),
      beat_2: String((arc as any).beat_2 || 'Conflict escalates.'),
      beat_3: String((arc as any).beat_3 || 'Consequence and hook.'),
    },
    series_bible: {
      global_style_bible: String((seriesBible as any).global_style_bible || 'Cinematic continuity and visual consistency.'),
      location_anchors: Array.isArray((seriesBible as any).location_anchors)
        ? (seriesBible as any).location_anchors
        : undefined,
      character_anchors: Array.isArray((seriesBible as any).character_anchors)
        ? (seriesBible as any).character_anchors
        : undefined,
      do_not_change: Array.isArray((seriesBible as any).do_not_change)
        ? (seriesBible as any).do_not_change
        : undefined,
    },
    shots,
    poster_spec: {
      style: String((posterSpec as any).style || 'cinematic'),
      key_visual: String((posterSpec as any).key_visual || series.title),
      mood: typeof (posterSpec as any).mood === 'string' ? (posterSpec as any).mood : undefined,
    },
  };
}

// =============================================================================
// Episode Production Service
// =============================================================================

export class EpisodeProductionService {
  private gradient: GradientClient | null;
  private modalVideo: ModalVideoClient | null;
  private spaces: SpacesClient | null;
  private readonly isConfigured: boolean;

  private readonly defaultTtsTimeoutMs = 120000;

  constructor(gradient?: GradientClient, spaces?: SpacesClient) {
    this.modalVideo = null;
    this.gradient = null;
    this.spaces = null;

    try {
      this.gradient = gradient || getGradientClient();
    } catch {
      console.warn('[EpisodeProduction] GradientClient not configured - prompt refinement disabled');
    }

    try {
      this.modalVideo = getModalVideoClient();
    } catch (e) {
      this.modalVideo = null;
      console.warn('[EpisodeProduction] Failed to init ModalVideoClient:', e);
    }

    try {
      this.spaces = spaces || getSpacesClient();
    } catch {
      this.spaces = null;
      console.warn('[EpisodeProduction] SpacesClient not configured - asset storage disabled');
    }

    this.isConfigured = this.modalVideo !== null && this.spaces !== null;
  }

  // ---------------------------------------------------------------------------
  // Enqueue
  // ---------------------------------------------------------------------------

  /**
   * Finds pending video series and enqueues production jobs.
   * Lightweight and safe to run from the voting cron tick.
   */
  async processPendingProductions(): Promise<{ processed: number; failed: number; skipped: boolean }> {
    const pendingSeries = await prisma.limitedSeries.findMany({
      where: {
        status: 'pending',
        medium: 'video',
      },
      include: {
        scripts: {
          where: { pilot_status: 'selected' },
          take: 1,
        },
      },
      take: 10,
      orderBy: { created_at: 'asc' },
    });

    let processed = 0;
    let failed = 0;

    for (const series of pendingSeries) {
      try {
        const rawScriptData = series.scripts[0]?.script_data
          ? parseJsonSafe<Record<string, unknown>>(series.scripts[0].script_data, {})
          : {};

        await this.enqueueSeriesProduction(series.id, rawScriptData);
        processed++;
      } catch (error) {
        failed++;
        console.error(`[EpisodeProduction] Failed to enqueue series ${series.id}:`, error);
      }
    }

    return { processed, failed, skipped: false };
  }

  async enqueueSeriesProduction(seriesId: string, rawScriptData?: unknown): Promise<{ createdEpisodes: number; enqueuedJobs: number }> {
    const db = prisma as any;
    const series = await prisma.limitedSeries.findUnique({ where: { id: seriesId } });
    if (!series) throw new Error(`Series ${seriesId} not found`);

    if (series.medium !== 'video') {
      return { createdEpisodes: 0, enqueuedJobs: 0 };
    }

    const scriptData = toScriptData(rawScriptData, series, series.title);

    let createdEpisodes = 0;
    let enqueuedJobs = 0;

    for (let episodeNumber = 1; episodeNumber <= 5; episodeNumber++) {
      const existingEpisode = await prisma.episode.findUnique({
        where: {
          series_id_episode_number: {
            series_id: series.id,
            episode_number: episodeNumber,
          },
        },
      });

      let episode = existingEpisode;
      if (!episode) {
        const episodeTitle = episodeNumber === 1
          ? `${scriptData.title || series.title} - Pilot`
          : `${scriptData.title || series.title} - Episode ${episodeNumber}`;

        episode = await prisma.episode.create({
          data: {
            series_id: series.id,
            episode_number: episodeNumber,
            title: episodeTitle,
            arc_data: JSON.stringify(scriptData.arc || {}),
            shots_data: JSON.stringify(scriptData.shots || []),
            status: JOB_STATUS_PENDING,
            runtime_seconds: 0,
          },
        });
        createdEpisodes++;
      }

      const jobType = episodeNumber === 1 ? JOB_TYPE_PILOT : JOB_TYPE_SINGLE;
      const existingJob = await db.productionJob.findUnique({
        where: {
          episode_id_job_type: {
            episode_id: episode.id,
            job_type: jobType,
          },
        },
      });

      if (!existingJob) {
        await db.productionJob.create({
          data: {
            series_id: series.id,
            episode_id: episode.id,
            job_type: jobType,
            status: JOB_STATUS_PENDING,
            priority: episodeNumber === 1 ? 100 : 50,
            attempt_count: 0,
            max_attempts: 3,
            available_at: new Date(),
          },
        });
        enqueuedJobs++;
      }
    }

    if (enqueuedJobs > 0) {
      await prisma.limitedSeries.update({
        where: { id: series.id },
        data: {
          status: 'producing',
        },
      });
    }

    return { createdEpisodes, enqueuedJobs };
  }

  // ---------------------------------------------------------------------------
  // Worker
  // ---------------------------------------------------------------------------

  async processQueuedJobs(options: QueueWorkerOptions = {}): Promise<QueueWorkerResult> {
    const db = prisma as any;
    if (!this.isConfigured) {
      return {
        processed: 0,
        completed: 0,
        retried: 0,
        failed: 0,
        skippedJobs: 0,
        skipped: true,
      };
    }

    const maxJobs = Math.max(1, Math.min(50, options.maxJobs || DEFAULT_MAX_JOBS));
    const maxRuntimeMs = Math.max(1_000, Math.min(120_000, options.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS));
    const deadline = Date.now() + maxRuntimeMs;

    const queue = await db.productionJob.findMany({
      where: {
        status: JOB_STATUS_PENDING,
        available_at: { lte: new Date() },
      },
      include: {
        series: true,
        episode: true,
      },
      orderBy: [
        { priority: 'desc' },
        { available_at: 'asc' },
        { created_at: 'asc' },
      ],
      take: maxJobs,
    });

    const stats: QueueWorkerResult = {
      processed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
      skippedJobs: 0,
      skipped: false,
    };

    for (const job of queue) {
      if (Date.now() > deadline) break;

      const claim = await db.productionJob.updateMany({
        where: {
          id: job.id,
          status: JOB_STATUS_PENDING,
        },
        data: {
          status: JOB_STATUS_PROCESSING,
          started_at: new Date(),
        },
      });

      if (claim.count === 0) {
        continue;
      }

      const claimed = await db.productionJob.findUnique({
        where: { id: job.id },
        include: {
          series: true,
          episode: true,
        },
      });

      if (!claimed) {
        continue;
      }

      stats.processed++;

      try {
        if (claimed.job_type === JOB_TYPE_PILOT) {
          await this.generatePilotVariants(claimed);
        } else if (claimed.job_type === JOB_TYPE_SINGLE) {
          await this.generateSingleEpisodeVariant(claimed);
        } else {
          throw new Error(`Unknown production job type: ${claimed.job_type}`);
        }

        await db.productionJob.update({
          where: { id: claimed.id },
          data: {
            status: JOB_STATUS_COMPLETED,
            completed_at: new Date(),
            last_error: null,
          },
        });

        await this.reconcileSeriesState(claimed.series_id);
        stats.completed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempt = claimed.attempt_count + 1;
        const reachedMax = attempt >= claimed.max_attempts;

        if (reachedMax) {
          await db.productionJob.update({
            where: { id: claimed.id },
            data: {
              status: JOB_STATUS_FAILED,
              attempt_count: attempt,
              last_error: message,
              available_at: new Date(),
            },
          });

          if (claimed.job_type === JOB_TYPE_PILOT) {
            await prisma.limitedSeries.update({
              where: { id: claimed.series_id },
              data: { status: 'failed' },
            });
          } else {
            await prisma.episode.update({
              where: { id: claimed.episode_id },
              data: { status: 'failed' },
            });
            await this.reconcileSeriesState(claimed.series_id);
          }

          stats.failed++;
        } else {
          const backoffMs = Math.min(30 * 60 * 1000, Math.pow(2, attempt - 1) * 60 * 1000);
          await db.productionJob.update({
            where: { id: claimed.id },
            data: {
              status: JOB_STATUS_PENDING,
              attempt_count: attempt,
              last_error: message,
              available_at: new Date(Date.now() + backoffMs),
              started_at: null,
            },
          });

          await prisma.episode.update({
            where: { id: claimed.episode_id },
            data: { status: JOB_STATUS_PENDING },
          });

          stats.retried++;
        }
      }
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // Compatibility status pass (no heavy generation)
  // ---------------------------------------------------------------------------

  async checkPendingGenerations(): Promise<{ updated: number; skipped: boolean }> {
    const seriesList = await prisma.limitedSeries.findMany({
      where: {
        medium: 'video',
        status: { in: ['producing', 'active'] },
      },
      select: { id: true },
      take: 20,
    });

    let updated = 0;

    for (const series of seriesList) {
      await this.reconcileSeriesState(series.id);
      updated++;
    }

    return { updated, skipped: false };
  }

  // ---------------------------------------------------------------------------
  // Job handlers
  // ---------------------------------------------------------------------------

  private async generatePilotVariants(job: ProductionJobRecord & { series: LimitedSeries; episode: Episode }): Promise<void> {
    if (job.episode.status === 'clip_selected' && job.episode.video_url) {
      return;
    }

    const scriptData = await this.loadScriptDataForEpisode(job.series, job.episode);

    await prisma.episode.update({
      where: { id: job.episode_id },
      data: {
        status: 'generating',
      },
    });

    const basePrompt = await this.buildVideoPrompt(job.series, scriptData, 1);
    const audioText = this.extractNarrationText(scriptData, job.series);
    const variants = this.generatePromptVariants(basePrompt);

    for (let i = 0; i < 4; i++) {
      const variantNumber = i + 1;
      const prompt = variants[i] || basePrompt;
      const seed = Date.now() + variantNumber;
      const startTime = Date.now();

      try {
        const generation = await this.modalVideo!.generateVideo({
          prompt,
          audio_text: audioText,
          seed,
          width: 1280,
          height: 704,
        });

        const videoBuffer = Buffer.from(generation.video_base64, 'base64');

        const uploadResult = await this.spaces!.upload({
          key: `episodes/${job.episode_id}/variant-${variantNumber}.mp4`,
          body: videoBuffer,
          contentType: 'video/mp4',
          metadata: {
            episodeId: job.episode_id,
            variantNumber: String(variantNumber),
            prompt: prompt.slice(0, 500),
            generatedBy: 'modal-ltx2',
            model: generation.model || 'LTX-2',
          },
        });

        await prisma.clipVariant.upsert({
          where: {
            episode_id_variant_number: {
              episode_id: job.episode_id,
              variant_number: variantNumber,
            },
          },
          update: {
            video_url: uploadResult.url,
            prompt,
            audio_text: audioText || undefined,
            model_used: generation.model || 'LTX-2',
            seed,
            generation_time_ms: Date.now() - startTime,
            status: 'completed',
            is_selected: false,
            error_message: null,
          },
          create: {
            episode_id: job.episode_id,
            variant_number: variantNumber,
            video_url: uploadResult.url,
            vote_count: 0,
            is_selected: false,
            prompt,
            audio_text: audioText || undefined,
            model_used: generation.model || 'LTX-2',
            seed,
            generation_time_ms: Date.now() - startTime,
            status: 'completed',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.clipVariant.upsert({
          where: {
            episode_id_variant_number: {
              episode_id: job.episode_id,
              variant_number: variantNumber,
            },
          },
          update: {
            video_url: null,
            prompt,
            model_used: 'LTX-2',
            seed,
            generation_time_ms: Date.now() - startTime,
            status: 'failed',
            error_message: message.slice(0, 1000),
            is_selected: false,
          },
          create: {
            episode_id: job.episode_id,
            variant_number: variantNumber,
            video_url: null,
            vote_count: 0,
            is_selected: false,
            prompt,
            model_used: 'LTX-2',
            seed,
            generation_time_ms: Date.now() - startTime,
            status: 'failed',
            error_message: message.slice(0, 1000),
          },
        });
        throw error;
      }
    }

    const runtime = getVotingRuntimeConfig();
    const clipVotingEndsAt = new Date(Date.now() + runtime.humanVotingDurationMinutes * 60 * 1000);

    await prisma.episode.update({
      where: { id: job.episode_id },
      data: {
        status: 'clip_voting',
        clip_voting_ends_at: clipVotingEndsAt,
      } as any,
    });

    await this.maybeGenerateEpisodeTts(job.episode, job.series, scriptData);
  }

  private async generateSingleEpisodeVariant(job: ProductionJobRecord & { series: LimitedSeries; episode: Episode }): Promise<void> {
    if (job.episode.status === 'clip_selected' && job.episode.video_url) {
      return;
    }

    const scriptData = await this.loadScriptDataForEpisode(job.series, job.episode);

    await prisma.episode.update({
      where: { id: job.episode_id },
      data: {
        status: 'generating',
      },
    });

    const prompt = await this.buildVideoPrompt(job.series, scriptData, job.episode.episode_number);
    const audioText = this.extractNarrationText(scriptData, job.series);
    const seed = Date.now() + job.episode.episode_number;
    const startTime = Date.now();

    const generation = await this.modalVideo!.generateVideo({
      prompt,
      audio_text: audioText,
      seed,
      width: 1280,
      height: 704,
    });

    const videoBuffer = Buffer.from(generation.video_base64, 'base64');

    const uploadResult = await this.spaces!.upload({
      key: `episodes/${job.episode_id}/variant-1.mp4`,
      body: videoBuffer,
      contentType: 'video/mp4',
      metadata: {
        episodeId: job.episode_id,
        variantNumber: '1',
        prompt: prompt.slice(0, 500),
        generatedBy: 'modal-ltx2',
        model: generation.model || 'LTX-2',
      },
    });

    await prisma.clipVariant.upsert({
      where: {
        episode_id_variant_number: {
          episode_id: job.episode_id,
          variant_number: 1,
        },
      },
      update: {
        video_url: uploadResult.url,
        prompt,
        audio_text: audioText || undefined,
        model_used: generation.model || 'LTX-2',
        seed,
        generation_time_ms: Date.now() - startTime,
        status: 'completed',
        is_selected: true,
        error_message: null,
      },
      create: {
        episode_id: job.episode_id,
        variant_number: 1,
        video_url: uploadResult.url,
        vote_count: 0,
        is_selected: true,
        prompt,
        audio_text: audioText || undefined,
        model_used: generation.model || 'LTX-2',
        seed,
        generation_time_ms: Date.now() - startTime,
        status: 'completed',
      },
    });

    await prisma.episode.update({
      where: { id: job.episode_id },
      data: {
        status: 'clip_selected',
        video_url: uploadResult.url,
        clip_voting_ends_at: null,
      } as any,
    });

    await this.maybeGenerateEpisodeTts(job.episode, job.series, scriptData);
  }

  private async loadScriptDataForEpisode(series: LimitedSeries, episode: Episode): Promise<ScriptData> {
    const fromEpisode = {
      title: episode.title,
      logline: series.logline,
      genre: series.genre,
      arc: parseJsonSafe<Record<string, unknown>>(episode.arc_data, {}),
      series_bible: parseJsonSafe<Record<string, unknown>>(series.series_bible, {}),
      shots: parseJsonSafe<unknown[]>(episode.shots_data, []),
      poster_spec: parseJsonSafe<Record<string, unknown>>(series.poster_spec, {}),
    };

    return toScriptData(fromEpisode, series, episode.title);
  }

  private async reconcileSeriesState(seriesId: string): Promise<void> {
    const db = prisma as any;
    const series = await db.limitedSeries.findUnique({
      where: { id: seriesId },
      include: {
        episodes: {
          orderBy: { episode_number: 'asc' },
          select: {
            id: true,
            episode_number: true,
            status: true,
            video_url: true,
          },
        },
        production_jobs: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!series || series.status === 'failed') return;

    const playableEpisodes = series.episodes.filter((ep: any) => ep.status === 'clip_selected' && !!ep.video_url);
    const pilot = series.episodes.find((ep: any) => ep.episode_number === 1);
    const pilotResolved = !!pilot && pilot.status === 'clip_selected' && !!pilot.video_url;
    const hasActiveJobs = series.production_jobs.some((job: any) =>
      job.status === JOB_STATUS_PENDING || job.status === JOB_STATUS_PROCESSING
    );
    const allPlayable = series.episodes.length >= 5 && playableEpisodes.length >= 5;

    if (allPlayable && pilotResolved) {
      await prisma.limitedSeries.update({
        where: { id: series.id },
        data: {
          status: 'completed',
          episode_count: 5,
          completed_at: series.completed_at || new Date(),
        },
      });
      return;
    }

    if (playableEpisodes.length > 0) {
      await prisma.limitedSeries.update({
        where: { id: series.id },
        data: {
          status: 'active',
          episode_count: playableEpisodes.length,
        },
      });
      return;
    }

    if (hasActiveJobs || series.status !== 'producing') {
      await prisma.limitedSeries.update({
        where: { id: series.id },
        data: {
          status: 'producing',
          episode_count: playableEpisodes.length,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt / media helpers
  // ---------------------------------------------------------------------------

  private async maybeGenerateEpisodeTts(
    episode: Episode,
    series: LimitedSeries,
    scriptData: ScriptData | null
  ): Promise<void> {
    if (!this.gradient || !this.spaces) return;
    if (!scriptData) return;

    if ((episode as any).tts_audio_url || (episode as any).ttsAudioUrl) return;

    const narrationText = this.extractNarrationText(scriptData, series);
    if (!narrationText) return;

    try {
      const ttsResult = await this.gradient.generateTTSAndWait(narrationText, {
        timeoutMs: this.defaultTtsTimeoutMs,
      });

      const audioResponse = await fetch(ttsResult.audio_url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download TTS audio: HTTP ${audioResponse.status}`);
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      const contentType = ttsResult.content_type || audioResponse.headers.get('content-type') || 'audio/mpeg';
      const ext = contentType.includes('wav') ? 'wav' : contentType.includes('mpeg') ? 'mp3' : 'mp3';

      const upload = await this.spaces.upload({
        key: `episodes/${episode.id}/tts.${ext}`,
        body: audioBuffer,
        contentType,
        metadata: {
          episodeId: String(episode.id),
          seriesId: String(episode.series_id),
          assetType: 'tts',
          generatedBy: 'gradient-elevenlabs-tts',
        },
      });

      await prisma.episode.update({
        where: { id: episode.id },
        data: { tts_audio_url: upload.url },
      });
    } catch (error) {
      console.warn('[EpisodeProduction] TTS generation failed (non-fatal):', error);
    }
  }

  private extractNarrationText(scriptData: ScriptData, series: LimitedSeries): string | null {
    const isTtsLike = (value: string) =>
      ['tts', 'narration', 'voiceover', 'voice_over', 'voice'].includes(value);

    const firstAudio = scriptData.shots?.[0]?.audio;
    const firstAudioType = firstAudio?.type?.toLowerCase?.() ?? '';
    if (firstAudio?.description && isTtsLike(firstAudioType)) {
      return firstAudio.description.trim();
    }

    const firstLegacyType = scriptData.shots?.[0]?.audio_type?.toLowerCase?.() ?? '';
    if (firstLegacyType === 'narration' && scriptData.shots?.[0]?.narration) {
      return scriptData.shots[0].narration.trim();
    }

    for (const shot of scriptData.shots || []) {
      const shotAudioType = shot.audio?.type?.toLowerCase?.() ?? '';
      if (shot.audio?.description && isTtsLike(shotAudioType)) {
        return shot.audio.description.trim();
      }

      const legacyType = shot.audio_type?.toLowerCase?.() ?? '';
      if (legacyType === 'narration' && shot.narration) {
        return shot.narration.trim();
      }
    }

    return null;
  }

  private async buildVideoPrompt(
    series: LimitedSeries,
    scriptData: ScriptData | null,
    episodeNumber: number
  ): Promise<string> {
    let basePrompt: string;

    if (!scriptData) {
      basePrompt = `Episode ${episodeNumber} of a cinematic ${series.genre} film scene. ${series.logline}.\nProfessional cinematography, dramatic lighting, high production value.`;
    } else {
      const styleBible = scriptData.series_bible.global_style_bible;
      const firstShot = scriptData.shots[0];
      const arc = scriptData.arc;

      basePrompt = `
Episode ${episodeNumber} continuation for the series "${series.title}".
${styleBible}

Story beat: ${arc.beat_1}

Camera: ${firstShot?.prompt.camera || 'wide'} shot
Scene: ${firstShot?.prompt.scene || scriptData.poster_spec.key_visual}
Motion: ${firstShot?.prompt.motion || 'slow pan'}
Mood: ${scriptData.poster_spec.mood || series.genre}

Style: Cinematic ${scriptData.poster_spec.style}, professional color grading, atmospheric lighting.
      `.trim();
    }

    if (this.gradient) {
      try {
        return await this.gradient.refineVideoPrompt(basePrompt);
      } catch (error) {
        console.warn('[EpisodeProduction] Prompt refinement failed, using raw prompt:', error);
      }
    }

    return basePrompt;
  }

  private generatePromptVariants(basePrompt: string): string[] {
    const variants: string[] = [];
    variants.push(`${basePrompt}\n\nWith dramatic atmospheric fog and volumetric lighting.`);
    variants.push(`${basePrompt}\n\nShot with slow dolly movement, shallow depth of field.`);
    variants.push(`${basePrompt}\n\nHigh contrast cinematography, rich shadows, silhouettes.`);
    variants.push(`${basePrompt}\n\nDynamic camera movement, energetic pacing, vivid colors.`);
    return variants;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let serviceInstance: EpisodeProductionService | null = null;

export function getEpisodeProductionService(): EpisodeProductionService {
  if (!serviceInstance) {
    serviceInstance = new EpisodeProductionService();
  }
  return serviceInstance;
}

export default EpisodeProductionService;

/**
 * AudioSeriesProductionService
 *
 * Produces audio-only limited series (5 episodes) by generating TTS for each episode
 * and uploading to Spaces. Designed to run from the existing cron tick.
 */

import crypto from 'crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { prisma } from '../lib/prisma';
import { GradientClient, getGradientClient } from './GradientClient';
import { SpacesClient, getSpacesClient } from './SpacesClient';

const execFileAsync = promisify(execFile);

export const AUDIO_QC = {
  minSeconds: 180, // 3 minutes
  maxSeconds: 360, // 6 minutes
  maxRetries: 3,
};

export type AudioProductionStats = {
  processedEpisodes: number;
  completedEpisodes: number;
  failedEpisodes: number;
  completedSeries: number;
  skipped: boolean;
};

type EpisodeAudioLifecycle = {
  tts_audio_url: string | null;
  status: string;
};

type SeriesAudioLifecycleStatus = 'completed' | 'in_production' | 'failed';

export async function probeDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const parsed = Number(String(stdout).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid duration from ffprobe');
  return parsed;
}

export function isDurationWithinBounds(durationSeconds: number): boolean {
  return durationSeconds >= AUDIO_QC.minSeconds && durationSeconds <= AUDIO_QC.maxSeconds;
}

export function resolveSeriesAudioLifecycleStatus(episodes: EpisodeAudioLifecycle[]): SeriesAudioLifecycleStatus {
  const allDone = episodes.length > 0 && episodes.every((e) => !!e.tts_audio_url);
  if (allDone) return 'completed';

  const hasRetryableWork = episodes.some((e) => !e.tts_audio_url && e.status !== 'failed');
  if (hasRetryableWork) return 'in_production';

  return 'failed';
}

export class AudioSeriesProductionService {
  private readonly gradient: GradientClient | null;
  private readonly spaces: SpacesClient | null;
  private readonly isConfigured: boolean;

  constructor(gradient?: GradientClient, spaces?: SpacesClient) {
    try {
      this.gradient = gradient || getGradientClient();
    } catch {
      this.gradient = null;
      console.warn('[AudioProduction] GradientClient not configured - audio production disabled');
    }

    try {
      this.spaces = spaces || getSpacesClient();
    } catch {
      this.spaces = null;
      console.warn('[AudioProduction] SpacesClient not configured - audio production disabled');
    }

    this.isConfigured = this.gradient !== null && this.spaces !== null;
  }

  async processPendingAudioProductions(): Promise<AudioProductionStats> {
    if (!this.isConfigured) {
      return { processedEpisodes: 0, completedEpisodes: 0, failedEpisodes: 0, completedSeries: 0, skipped: true };
    }

    const seriesList = await prisma.limitedSeries.findMany({
      where: {
        medium: 'audio',
        status: { in: ['in_production', 'failed'] },
      },
      include: {
        episodes: { orderBy: { episode_number: 'asc' } },
      },
      take: 5,
      orderBy: { created_at: 'asc' },
    });

    let processedEpisodes = 0;
    let completedEpisodes = 0;
    let failedEpisodes = 0;
    let completedSeries = 0;

    for (const series of seriesList) {
      const missing = series.episodes.filter((e) => !e.tts_audio_url && e.status !== 'failed');

      for (const episode of missing) {
        processedEpisodes++;
        const outcome = await this.processEpisode(series.id, series.narration_voice_id, episode.id);
        if (outcome === 'completed') completedEpisodes++;
        if (outcome === 'failed') failedEpisodes++;
      }

      const refreshed = await prisma.episode.findMany({
        where: { series_id: series.id },
        select: { tts_audio_url: true, status: true },
      });

      const lifecycleStatus = resolveSeriesAudioLifecycleStatus(refreshed);

      if (lifecycleStatus === 'completed') {
        await prisma.limitedSeries.update({
          where: { id: series.id },
          data: { status: 'completed', completed_at: new Date() },
        });
        completedSeries++;
      } else if (lifecycleStatus === 'failed') {
        await prisma.limitedSeries.update({
          where: { id: series.id },
          data: { status: 'failed' },
        });
      } else if (series.status !== 'in_production') {
        await prisma.limitedSeries.update({
          where: { id: series.id },
          data: { status: 'in_production' },
        });
      }
    }

    return { processedEpisodes, completedEpisodes, failedEpisodes, completedSeries, skipped: false };
  }

  private async processEpisode(
    seriesId: string,
    narrationVoiceId: string | null,
    episodeId: string
  ): Promise<'completed' | 'failed' | 'skipped'> {
    if (!this.gradient || !this.spaces) return 'skipped';

    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        id: true,
        series_id: true,
        episode_number: true,
        title: true,
        audio_script_text: true,
        tts_audio_url: true,
        tts_retry_count: true,
        status: true,
      },
    });

    if (!episode || episode.series_id !== seriesId) return 'skipped';
    if (episode.tts_audio_url) return 'skipped';
    if (!episode.audio_script_text || episode.audio_script_text.trim().length === 0) {
      await prisma.episode.update({
        where: { id: episode.id },
        data: { status: 'failed', tts_error_message: 'missing_audio_script_text' },
      });
      return 'failed';
    }

    if (episode.tts_retry_count >= AUDIO_QC.maxRetries) {
      await prisma.episode.update({
        where: { id: episode.id },
        data: { status: 'failed', tts_error_message: 'max_retries_exceeded' },
      });
      return 'failed';
    }

    const attempt = episode.tts_retry_count + 1;
    await prisma.episode.update({
      where: { id: episode.id },
      data: { status: 'generating_tts' },
    });

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `molt-audio-${crypto.randomBytes(4).toString('hex')}-`));

    try {
      const tts = await this.gradient.generateTTSAndWait(episode.audio_script_text, {
        timeoutMs: 6 * 60 * 1000,
        voiceId: narrationVoiceId || undefined,
      });

      const audioRes = await fetch(tts.audio_url);
      if (!audioRes.ok) throw new Error(`Failed to download TTS audio: HTTP ${audioRes.status}`);

      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      const contentType = tts.content_type || audioRes.headers.get('content-type') || 'audio/mpeg';
      const ext = contentType.includes('wav') ? 'wav' : 'mp3';
      const localPath = path.join(tmpDir, `tts.${ext}`);
      await fs.writeFile(localPath, audioBuffer);

      const durationSeconds = await probeDurationSeconds(localPath);
      if (!isDurationWithinBounds(durationSeconds)) {
        throw new Error(`duration_out_of_bounds:${durationSeconds.toFixed(2)}`);
      }

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
        data: {
          tts_audio_url: upload.url,
          runtime_seconds: Math.round(durationSeconds),
          status: 'completed',
          tts_error_message: null,
        },
      });

      console.log(`[AudioProduction] Episode TTS uploaded (series=${seriesId} ep=${episode.episode_number}) attempt=${attempt}`);
      return 'completed';
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const nextRetryCount = episode.tts_retry_count + 1;

      const terminal = nextRetryCount >= AUDIO_QC.maxRetries;
      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          tts_retry_count: nextRetryCount,
          tts_error_message: message,
          status: terminal ? 'failed' : 'pending',
        },
      });

      console.warn(`[AudioProduction] Episode TTS failed (series=${seriesId} ep=${episode.episode_number}) attempt=${attempt}: ${message}`);
      return terminal ? 'failed' : 'skipped';
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

let serviceInstance: AudioSeriesProductionService | null = null;
export function getAudioSeriesProductionService(): AudioSeriesProductionService {
  if (!serviceInstance) serviceInstance = new AudioSeriesProductionService();
  return serviceInstance;
}

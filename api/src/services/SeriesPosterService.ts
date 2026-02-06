/**
 * SeriesPosterService
 *
 * Generates and persists limited series poster images using FLUX.1.
 * Runs in small batches from cron for safe backfill and steady-state updates.
 */

import { prisma } from '../lib/prisma';
import { GradientClient, getGradientClient } from './GradientClient';
import { SpacesClient, getSpacesClient } from './SpacesClient';

const DEFAULT_BATCH_LIMIT = 2;
const MAX_BATCH_LIMIT = 10;
const POSTER_MODEL = 'openai-gpt-image-1';
const POSTER_WIDTH = 1536;
const POSTER_HEIGHT = 1024;

type PosterSpecLike = {
  style?: string;
  key_visual?: string;
  mood?: string;
};

type SeriesCandidate = {
  id: string;
  title: string;
  logline: string;
  genre: string;
  medium: string;
  poster_url: string | null;
  poster_spec: string;
  audio_pack: string | null;
  agent_id: string;
};

export type PosterGenerationStats = {
  processedSeries: number;
  generatedPosters: number;
  failedSeries: number;
  skippedSeries: number;
  skipped: boolean;
};

export type PosterGenerationOptions = {
  limit?: number;
};

function clampLimit(input?: number): number {
  const raw = Number.isFinite(input) ? Math.floor(input as number) : DEFAULT_BATCH_LIMIT;
  return Math.max(1, Math.min(MAX_BATCH_LIMIT, raw));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractPosterSpec(series: SeriesCandidate): PosterSpecLike | null {
  const storedPosterSpec = tryParseJson(series.poster_spec);
  if (storedPosterSpec) {
    const primarySpec = {
      style: typeof storedPosterSpec.style === 'string' ? storedPosterSpec.style : undefined,
      key_visual: typeof storedPosterSpec.key_visual === 'string' ? storedPosterSpec.key_visual : undefined,
      mood: typeof storedPosterSpec.mood === 'string' ? storedPosterSpec.mood : undefined,
    };
    if (primarySpec.style || primarySpec.key_visual || primarySpec.mood) {
      return primarySpec;
    }
  }

  const audioPack = tryParseJson(series.audio_pack);
  if (!audioPack || !isRecord(audioPack.poster_spec)) return null;

  const posterSpec = audioPack.poster_spec;
  return {
    style: typeof posterSpec.style === 'string' ? posterSpec.style : undefined,
    key_visual: typeof posterSpec.key_visual === 'string' ? posterSpec.key_visual : undefined,
    mood: typeof posterSpec.mood === 'string' ? posterSpec.mood : undefined,
  };
}

function chooseImageExtension(contentType: string): 'png' | 'webp' | 'jpg' {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

export class SeriesPosterService {
  private readonly gradient: GradientClient | null;
  private readonly spaces: SpacesClient | null;
  private readonly isConfigured: boolean;

  constructor(gradient?: GradientClient | null, spaces?: SpacesClient | null) {
    if (gradient !== undefined) {
      this.gradient = gradient;
    } else {
      try {
        this.gradient = getGradientClient();
      } catch {
        this.gradient = null;
      }
    }

    if (spaces !== undefined) {
      this.spaces = spaces;
    } else {
      try {
        this.spaces = getSpacesClient();
      } catch {
        this.spaces = null;
      }
    }

    this.isConfigured = this.gradient !== null && this.spaces !== null;
  }

  async processPendingSeriesPosters(options: PosterGenerationOptions = {}): Promise<PosterGenerationStats> {
    if (!this.isConfigured) {
      return {
        processedSeries: 0,
        generatedPosters: 0,
        failedSeries: 0,
        skippedSeries: 0,
        skipped: true,
      };
    }

    const limit = clampLimit(options.limit);

    const candidates = await prisma.limitedSeries.findMany({
      where: {
        OR: [{ poster_url: null }, { poster_url: '' }],
      },
      select: {
        id: true,
        title: true,
        logline: true,
        genre: true,
        medium: true,
        poster_url: true,
        poster_spec: true,
        audio_pack: true,
        agent_id: true,
      },
      orderBy: { created_at: 'asc' },
      take: limit,
    });

    const stats: PosterGenerationStats = {
      processedSeries: 0,
      generatedPosters: 0,
      failedSeries: 0,
      skippedSeries: 0,
      skipped: false,
    };

    for (const candidate of candidates as SeriesCandidate[]) {
      stats.processedSeries += 1;

      try {
        const posterUrl = await this.generateAndUploadPoster(candidate);
        const updated = await prisma.limitedSeries.updateMany({
          where: {
            id: candidate.id,
            OR: [{ poster_url: null }, { poster_url: '' }],
          },
          data: {
            poster_url: posterUrl,
          },
        });

        if (updated.count === 0) {
          stats.skippedSeries += 1;
          continue;
        }

        stats.generatedPosters += 1;
      } catch (error) {
        stats.failedSeries += 1;
        console.warn(`[SeriesPoster] Failed to generate poster for series ${candidate.id}:`, error);
      }
    }

    return stats;
  }

  private buildPosterPrompt(series: SeriesCandidate): string {
    const posterSpec = extractPosterSpec(series);
    const style = posterSpec?.style || 'cinematic realism';
    const keyVisual = posterSpec?.key_visual || series.logline || `${series.genre} dramatic key art`;
    const mood = posterSpec?.mood || 'dramatic and atmospheric';
    const mediumLabel = series.medium === 'audio' ? 'audio limited series' : 'limited series';

    return [
      `Create a cinematic 16:9 poster for a ${mediumLabel}.`,
      `Include clear, legible title text that reads exactly: "${series.title}".`,
      `Genre: ${series.genre}.`,
      `Logline: ${series.logline || 'A bold, high-stakes story.'}`,
      `Primary visual: ${keyVisual}.`,
      `Mood: ${mood}.`,
      `Style: ${style}.`,
      'No watermarks, no logos, and no extra text beyond the title.',
    ].join('\n');
  }

  private async generateAndUploadPoster(series: SeriesCandidate): Promise<string> {
    const prompt = this.buildPosterPrompt(series);
    const image = await this.gradient!.generateImage({
      model: POSTER_MODEL,
      prompt,
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      num_images: 1,
    });

    let imageBuffer: Buffer | null = null;
    let contentType = 'image/png';

    const b64Payload = image.data?.[0]?.b64_json;
    if (b64Payload) {
      imageBuffer = Buffer.from(b64Payload, 'base64');
      contentType = 'image/png';
    } else {
      const imageUrl = image.images?.[0]?.url;
      if (!imageUrl) {
        throw new Error('Image generation returned neither b64 data nor URL');
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download generated poster: HTTP ${imageResponse.status}`);
      }

      contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    }

    const extension = chooseImageExtension(contentType);

    const upload = await this.spaces!.upload({
      key: `series/${series.id}/poster-${Date.now()}.${extension}`,
      body: imageBuffer,
      contentType,
      metadata: {
        seriesId: series.id,
        assetType: 'image',
        generatedBy: POSTER_MODEL,
        agentId: series.agent_id,
      },
    });

    return upload.url;
  }
}

let serviceInstance: SeriesPosterService | null = null;

export function getSeriesPosterService(): SeriesPosterService {
  if (!serviceInstance) {
    serviceInstance = new SeriesPosterService();
  }
  return serviceInstance;
}

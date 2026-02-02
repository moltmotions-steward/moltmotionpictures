/**
 * Episode Production Service
 * 
 * Orchestrates the production pipeline for Limited Series episodes:
 * 1. Takes a winning script from agent voting
 * 2. Creates episode record
 * 3. Generates 4 clip variants via Luma Dream Machine
 * 4. Opens human voting on clip variants
 * 
 * This is the core "assembly line" that turns scripts into watchable content.
 */

import crypto from 'crypto';
import { PrismaClient, LimitedSeries, Episode, ClipVariant } from '@prisma/client';
import { GradientClient, getGradientClient } from './GradientClient';
import { SpacesClient, getSpacesClient } from './SpacesClient';

const prisma = new PrismaClient();

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
    audio?: { type: string; description: string };
  }>;
  poster_spec: {
    style: string;
    key_visual: string;
    mood?: string;
  };
}

export interface ProductionJob {
  seriesId: string;
  episodeNumber: number;
  variantCount: number;
}

export interface ClipGenerationResult {
  variantNumber: number;
  generationId: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface EpisodeProductionResult {
  episodeId: string;
  status: 'pending' | 'generating' | 'clip_voting' | 'failed';
  variants: ClipGenerationResult[];
}

// =============================================================================
// Episode Production Service
// =============================================================================

export class EpisodeProductionService {
  private gradient: GradientClient | null;
  private spaces: SpacesClient | null;
  private readonly isConfigured: boolean;

  private normalizeLumaClipSeconds(requestedSeconds?: number): 5 | 10 {
    if (requestedSeconds === 10) return 10;
    if (requestedSeconds === 5) return 5;
    if (typeof requestedSeconds !== 'number' || !Number.isFinite(requestedSeconds)) return 10;
    return requestedSeconds <= 5 ? 5 : 10;
  }

  constructor(gradient?: GradientClient, spaces?: SpacesClient) {
    // Gracefully handle missing API keys
    try {
      this.gradient = gradient || getGradientClient();
    } catch {
      this.gradient = null;
      console.warn('[EpisodeProduction] GradientClient not configured - clip generation disabled');
    }
    
    try {
      this.spaces = spaces || getSpacesClient();
    } catch {
      this.spaces = null;
      console.warn('[EpisodeProduction] SpacesClient not configured - asset storage disabled');
    }
    
    this.isConfigured = this.gradient !== null && this.spaces !== null;
  }

  // ---------------------------------------------------------------------------
  // Main Entry Point: Process Pending Series
  // ---------------------------------------------------------------------------

  /**
   * Finds all pending LimitedSeries and initiates clip generation.
   * Called by the cron job.
   */
  async processPendingProductions(): Promise<{ processed: number; failed: number; skipped: boolean }> {
    // Skip if not configured
    if (!this.isConfigured) {
      console.log('[EpisodeProduction] Skipping - production services not configured');
      return { processed: 0, failed: 0, skipped: true };
    }

    const pendingSeries = await prisma.limitedSeries.findMany({
      where: { status: 'pending' },
      include: {
        studio: true,
        scripts: {
          where: { pilot_status: 'selected' },
          take: 1,
        },
      },
      take: 5, // Process in batches to avoid overload
    });

    let processed = 0;
    let failed = 0;

    for (const series of pendingSeries) {
      try {
        console.log(`[EpisodeProduction] Processing series ${series.id}: ${series.title}`);
        
        // Parse script data from the linked script
        let scriptData: ScriptData | null = null;
        const sourceScript = series.scripts[0];
        if (sourceScript?.script_data) {
          try {
            scriptData = JSON.parse(sourceScript.script_data) as ScriptData;
          } catch {
            console.error(`[EpisodeProduction] Failed to parse script data for series ${series.id}`);
          }
        }

        // Create pilot episode
        const episode = await this.createPilotEpisode(series, scriptData);
        
        // Start clip generation (async - returns immediately)
        await this.initiateClipGeneration(episode, series, scriptData);
        
        // Update series status to 'producing'
        await prisma.limitedSeries.update({
          where: { id: series.id },
          data: { status: 'producing' },
        });

        processed++;
      } catch (error) {
        console.error(`[EpisodeProduction] Failed to process series ${series.id}:`, error);
        
        await prisma.limitedSeries.update({
          where: { id: series.id },
          data: { status: 'failed' },
        });
        
        failed++;
      }
    }

    console.log(`[EpisodeProduction] Batch complete: ${processed} processed, ${failed} failed`);
    return { processed, failed, skipped: false };
  }

  // ---------------------------------------------------------------------------
  // Pilot Episode Creation
  // ---------------------------------------------------------------------------

  /**
   * Creates the pilot episode (Episode 1) for a new series.
   */
  async createPilotEpisode(
    series: LimitedSeries,
    scriptData: ScriptData | null
  ): Promise<Episode> {
    const episodeTitle = scriptData?.title 
      ? `${scriptData.title} - Pilot`
      : `${series.title} - Pilot`;

    const episode = await prisma.episode.create({
      data: {
        series_id: series.id,
        episode_number: 1,
        title: episodeTitle,
        arc_data: JSON.stringify(scriptData?.arc || {}),
        shots_data: JSON.stringify(scriptData?.shots || []),
        status: 'pending',
        runtime_seconds: 0,
      },
    });

    console.log(`[EpisodeProduction] Created pilot episode ${episode.id} for series ${series.id}`);
    return episode;
  }

  // ---------------------------------------------------------------------------
  // Clip Variant Generation
  // ---------------------------------------------------------------------------

  /**
   * Initiates generation of 4 clip variants for an episode.
   * Uses different shot sequences and styles for variety.
   */
  async initiateClipGeneration(
    episode: Episode,
    series: LimitedSeries,
    scriptData: ScriptData | null
  ): Promise<ClipGenerationResult[]> {
    const results: ClipGenerationResult[] = [];
    const VARIANT_COUNT = 4;

    // Generate base prompt from script data
    const basePrompt = await this.buildVideoPrompt(series, scriptData);
    
    // Generate 4 variants with different stylistic approaches
    const variants = this.generatePromptVariants(basePrompt, scriptData);

    const requestedClipSeconds = scriptData?.shots?.[0]?.gen_clip_seconds;
    const clipSeconds = this.normalizeLumaClipSeconds(requestedClipSeconds);

    for (let i = 0; i < VARIANT_COUNT; i++) {
      try {
        const prompt = variants[i] || basePrompt;
        
        console.log(`[EpisodeProduction] Generating variant ${i + 1} for episode ${episode.id}`);
        
        // Call Luma Dream Machine via Gradient
        const generation = await this.gradient!.generateShot(prompt, {
          aspectRatio: '16:9',
          duration: clipSeconds, // Provider-limited (Luma typically 5–10s)
        });

        // Create clip variant record with generation ID
        const clipVariant = await prisma.clipVariant.create({
          data: {
            episode_id: episode.id,
            variant_number: i + 1,
            video_url: '', // Will be updated when generation completes
            vote_count: 0,
            is_selected: false,
          },
        });

        results.push({
          variantNumber: i + 1,
          generationId: generation.id,
          status: 'generating',
        });

        // Store generation ID for polling (we'll need to add this field to ClipVariant)
        // For now, we'll use a separate tracking mechanism
        await this.trackGeneration(clipVariant.id, generation.id);

      } catch (error) {
        console.error(`[EpisodeProduction] Failed to generate variant ${i + 1}:`, error);
        results.push({
          variantNumber: i + 1,
          generationId: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update episode status
    const successCount = results.filter(r => r.status === 'generating').length;
    if (successCount > 0) {
      await prisma.episode.update({
        where: { id: episode.id },
        data: { status: 'generating' },
      });
    }

    return results;
  }

  /**
   * Builds a video generation prompt from series/script data.
   */
  private async buildVideoPrompt(
    series: LimitedSeries,
    scriptData: ScriptData | null
  ): Promise<string> {
    if (!scriptData) {
      // Fallback to generating from title/logline
      return await this.gradient!.refineVideoPrompt(
        `A ${series.genre} film scene. ${series.logline}`
      );
    }

    // Build rich prompt from script data
    const styleBible = scriptData.series_bible.global_style_bible;
    const firstShot = scriptData.shots[0];
    const arc = scriptData.arc;

    const basePrompt = `
${styleBible}

Opening scene: ${arc.beat_1}

Camera: ${firstShot?.prompt.camera || 'wide'} shot
Scene: ${firstShot?.prompt.scene || scriptData.poster_spec.key_visual}
Motion: ${firstShot?.prompt.motion || 'slow pan'}
Mood: ${scriptData.poster_spec.mood || series.genre}

Style: Cinematic ${scriptData.poster_spec.style}, professional color grading, atmospheric lighting.
    `.trim();

    return await this.gradient!.refineVideoPrompt(basePrompt);
  }

  /**
   * Generates 4 stylistic variants of the base prompt.
   */
  private generatePromptVariants(basePrompt: string, scriptData: ScriptData | null): string[] {
    const variants: string[] = [];
    
    // Variant 1: Original with enhanced atmosphere
    variants.push(`${basePrompt}\n\nWith dramatic atmospheric fog and volumetric lighting.`);
    
    // Variant 2: Different camera approach
    variants.push(`${basePrompt}\n\nShot with slow dolly movement, shallow depth of field.`);
    
    // Variant 3: High contrast style
    variants.push(`${basePrompt}\n\nHigh contrast cinematography, rich shadows, silhouettes.`);
    
    // Variant 4: Dynamic energy
    variants.push(`${basePrompt}\n\nDynamic camera movement, energetic pacing, vivid colors.`);
    
    return variants;
  }

  // ---------------------------------------------------------------------------
  // Generation Tracking & Polling
  // ---------------------------------------------------------------------------

  /**
   * Tracks a video generation for later polling.
   * Stores in a simple key-value structure (could be Redis in production).
   */
  private generationTracker: Map<string, string> = new Map();

  private async trackGeneration(clipVariantId: string, generationId: string): Promise<void> {
    this.generationTracker.set(clipVariantId, generationId);
    
    // Also store in database for persistence across restarts
    // We'll use series_bible temporarily (or add a generation_id column)
    // For now, log it
    console.log(`[EpisodeProduction] Tracking generation: ${clipVariantId} -> ${generationId}`);
  }

  /**
   * Polls pending generations and updates clip variants when complete.
   * Called by the cron job.
   */
  async pollPendingGenerations(): Promise<{ completed: number; failed: number; skipped: boolean }> {
    // Skip if not configured
    if (!this.isConfigured || !this.gradient) {
      return { completed: 0, failed: 0, skipped: true };
    }

    // Find episodes in 'generating' status
    const generatingEpisodes = await prisma.episode.findMany({
      where: { status: 'generating' },
      include: {
        clip_variants: true,
      },
      take: 10,
    });

    let completed = 0;
    let failed = 0;

    for (const episode of generatingEpisodes) {
      let allComplete = true;
      let anyFailed = false;

      for (const variant of episode.clip_variants) {
        // Skip already processed variants
        if (variant.video_url) continue;

        const generationId = this.generationTracker.get(variant.id);
        if (!generationId) {
          console.warn(`[EpisodeProduction] No generation ID for variant ${variant.id}`);
          continue;
        }

        try {
          const status = await this.gradient.getVideoStatus(generationId);

          if (status.status === 'completed' && status.video_url) {
            // Download and store in Spaces
            const storedUrl = await this.storeClipAsset(
              episode.series_id,
              episode.id,
              variant.id,
              status.video_url
            );

            await prisma.clipVariant.update({
              where: { id: variant.id },
              data: {
                video_url: storedUrl,
                thumbnail_url: status.thumbnail_url || null,
              },
            });

            completed++;
          } else if (status.status === 'failed') {
            anyFailed = true;
            failed++;
          } else {
            // Still generating
            allComplete = false;
          }
        } catch (error) {
          console.error(`[EpisodeProduction] Failed to poll variant ${variant.id}:`, error);
          anyFailed = true;
        }
      }

      // Update episode status if all variants are done
      if (allComplete) {
        await prisma.episode.update({
          where: { id: episode.id },
          data: { status: anyFailed ? 'failed' : 'clip_voting' },
        });

        // If successful, update series status
        if (!anyFailed) {
          await prisma.limitedSeries.update({
            where: { id: episode.series_id },
            data: { status: 'active', episode_count: 1 },
          });
        }

        console.log(`[EpisodeProduction] Episode ${episode.id} generation complete, status: ${anyFailed ? 'failed' : 'clip_voting'}`);
      }
    }

    return { completed, failed, skipped: false };
  }

  /**
   * Downloads a video from URL and stores in DO Spaces.
   */
  private async storeClipAsset(
    seriesId: string,
    episodeId: string,
    variantId: string,
    sourceUrl: string
  ): Promise<string> {
    const path = `series/${seriesId}/episodes/${episodeId}/clips/${variantId}.mp4`;
    
    const asset = await this.spaces!.uploadFromUrl(sourceUrl, path, {
      productionId: seriesId, // Use seriesId as productionId
      assetType: 'video',
      generatedBy: 'luma-dream-machine',
      agentId: '', // System-generated
      createdAt: new Date().toISOString(),
    });

    return asset.url;
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

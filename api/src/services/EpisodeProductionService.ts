/**
 * Episode Production Service
 * 
 * Orchestrates the production pipeline for Limited Series episodes:
 * 1. Takes a winning script from agent voting
 * 2. Creates episode record
 * 3. Generates 4 clip variants via Modal (Mochi text-to-video)
 * 4. Opens human voting on clip variants
 * 
 * This is the core "assembly line" that turns scripts into watchable content.
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { LimitedSeries, Episode, ClipVariant } from '@prisma/client';
import { GradientClient, getGradientClient } from './GradientClient';
import { SpacesClient, getSpacesClient } from './SpacesClient';
import { ModalVideoClient, getModalVideoClient, VideoGenerationResponse } from './ModalVideoClient';

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

    // Legacy fields (older agent schema)
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
  private modalVideo: ModalVideoClient | null;
  private spaces: SpacesClient | null;
  private readonly isConfigured: boolean;

  private readonly defaultTtsTimeoutMs = 120000; // TTS can take longer than prompt refinement

  constructor(gradient?: GradientClient, spaces?: SpacesClient) {
    // Initialize potential nulls
    this.modalVideo = null;
    this.gradient = null;
    this.spaces = null;

    // Gradient client for LLM calls (prompt refinement)
    try {
      this.gradient = gradient || getGradientClient();
    } catch {
      console.warn('[EpisodeProduction] GradientClient not configured - prompt refinement disabled');
    }

    // Modal Video Client (LTX-2)
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
    
    // We need Video generator and Spaces for storage
    this.isConfigured = this.modalVideo !== null && this.spaces !== null;
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
   * Calculate number of frames based on desired duration.
   * LTX-2 generates at 24fps. 121 frames is ~5s.
   */
  private calculateFrames(durationSeconds: number): number {
    // Clamp to reasonable range for LTX-2: 3-5 seconds
    const clampedDuration = Math.max(3, Math.min(5, durationSeconds));
    // LTX-2 prefers odd number of frames + 1 usually, e.g. 121. 
    // But let's just do roughly 24fps. 
    // Actually, LTX-2 default in our Client is 121 frames.
    return Math.round(clampedDuration * 24);
  }

  /**
   * Initiates generation of 4 clip variants for an episode.
   * Uses different shot sequences and styles for variety.
   * Uses Modal + LTX-2 for synchronized audio-video generation.
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
    
    // Extract audio text (narration/dialogue) if available
    const audioText = scriptData ? this.extractNarrationText(scriptData, series) : null;
    
    // Generate 4 variants with different stylistic approaches
    const variants = this.generatePromptVariants(basePrompt, scriptData);

    for (let i = 0; i < VARIANT_COUNT; i++) {
      const prompt = variants[i] || basePrompt;
      const seed = Date.now() + i;
      const startTime = Date.now();
      
      try {
        console.log(`[EpisodeProduction] Generating variant ${i + 1} for episode ${episode.id}`);
        
        // Generate video using Modal LTX-2
        const generation = await this.modalVideo!.generateVideo({
            prompt: prompt,
            audio_text: audioText, // Pass synchronized audio text
            seed: seed,
            width: 1280, // LTX-2 Divisible by 32
            height: 704
        });
        
        // Modal client returns base64 video
        const videoBuffer = Buffer.from(generation.video_base64, 'base64');
        const generationTimeMs = Date.now() - startTime;

        // Upload to Spaces storage
        const uploadResult = await this.spaces!.upload({
          key: `episodes/${episode.id}/variant-${i + 1}.mp4`,
          body: videoBuffer,
          contentType: 'video/mp4',
          metadata: {
            episodeId: episode.id,
            variantNumber: String(i + 1),
            prompt: prompt.slice(0, 500),
            generatedBy: 'modal-ltx2',
            model: generation.model || 'LTX-2'
          },
        });
        const videoUrl = uploadResult.url;

        // Create clip variant record with full generation metadata
        const clipVariant = await prisma.clipVariant.create({
          data: {
            episode_id: episode.id,
            variant_number: i + 1,
            video_url: videoUrl,
            vote_count: 0,
            is_selected: false,
            // Generation metadata
            prompt: prompt,
            audio_text: audioText || undefined, // Store transcript
            model_used: generation.model || 'LTX-2',
            seed: seed,
            generation_time_ms: generationTimeMs,
            status: 'completed',
          },
        });

        results.push({
          variantNumber: i + 1,
          generationId: clipVariant.id, // Use clipVariant ID as generation ID
          status: 'completed',
          videoUrl: videoUrl,
        });

        console.log(`[EpisodeProduction] Variant ${i + 1} completed in ${(generationTimeMs / 1000).toFixed(1)}s: ${videoUrl}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[EpisodeProduction] Failed to generate variant ${i + 1}:`, error);
        
        // Create failed variant record with error information
        const failedVariant = await prisma.clipVariant.create({
          data: {
            episode_id: episode.id,
            variant_number: i + 1,
            video_url: null,
            vote_count: 0,
            is_selected: false,
            prompt: prompt,
            model_used: 'LTX-2',
            seed: seed,
            generation_time_ms: Date.now() - startTime,
            status: 'failed',
            error_message: errorMessage.slice(0, 1000), // Limit error length
          },
        });
        
        results.push({
          variantNumber: i + 1,
          generationId: failedVariant.id,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    // Update episode status based on results
    const successCount = results.filter(r => r.status === 'completed').length;
    if (successCount > 0) {
      // If we have at least one successful variant, move to clip_voting
      await prisma.episode.update({
        where: { id: episode.id },
        data: { status: successCount === VARIANT_COUNT ? 'clip_voting' : 'generating' },
      });

      // Optional: generate episode-level TTS (narration/voiceover) if specified in the script
      await this.maybeGenerateEpisodeTts(episode, series, scriptData);
    }

    return results;
  }

  private async maybeGenerateEpisodeTts(
    episode: Episode,
    series: LimitedSeries,
    scriptData: ScriptData | null
  ): Promise<void> {
    // Only run when configured for both TTS generation and storage
    if (!this.gradient || !this.spaces) return;
    if (!scriptData) return;

    // Avoid regenerating if already present
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

      console.log(`[EpisodeProduction] TTS audio uploaded for episode ${episode.id}: ${upload.url}`);
    } catch (error) {
      console.warn('[EpisodeProduction] TTS generation failed (non-fatal):', error);
    }
  }

  private extractNarrationText(scriptData: ScriptData, series: LimitedSeries): string | null {
    const isTtsLike = (value: string) =>
      ['tts', 'narration', 'voiceover', 'voice_over', 'voice'].includes(value);

    // Preferred: structured audio directive (new schema)
    const firstAudio = scriptData.shots?.[0]?.audio;
    const firstAudioType = firstAudio?.type?.toLowerCase?.() ?? '';
    if (firstAudio?.description && isTtsLike(firstAudioType)) {
      return firstAudio.description.trim();
    }

    // Legacy: audio_type + narration
    const firstLegacyType = scriptData.shots?.[0]?.audio_type?.toLowerCase?.() ?? '';
    if (firstLegacyType === 'narration' && scriptData.shots?.[0]?.narration) {
      return scriptData.shots[0].narration.trim();
    }

    // Fallback: scan for first available TTS-like directive
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

  /**
   * Builds a video generation prompt from series/script data.
   * Uses Gradient LLM for refinement if available, otherwise builds directly.
   */
  private async buildVideoPrompt(
    series: LimitedSeries,
    scriptData: ScriptData | null
  ): Promise<string> {
    let basePrompt: string;

    if (!scriptData) {
      // Simple fallback from title/logline
      basePrompt = `A cinematic ${series.genre} film scene. ${series.logline}. 
Professional cinematography, dramatic lighting, high production value.`;
    } else {
      // Build rich prompt from script data
      const styleBible = scriptData.series_bible.global_style_bible;
      const firstShot = scriptData.shots[0];
      const arc = scriptData.arc;

      basePrompt = `
${styleBible}

Opening scene: ${arc.beat_1}

Camera: ${firstShot?.prompt.camera || 'wide'} shot
Scene: ${firstShot?.prompt.scene || scriptData.poster_spec.key_visual}
Motion: ${firstShot?.prompt.motion || 'slow pan'}
Mood: ${scriptData.poster_spec.mood || series.genre}

Style: Cinematic ${scriptData.poster_spec.style}, professional color grading, atmospheric lighting.
      `.trim();
    }

    // Use Gradient LLM to refine prompt if available
    if (this.gradient) {
      try {
        return await this.gradient.refineVideoPrompt(basePrompt);
      } catch (error) {
        console.warn('[EpisodeProduction] Prompt refinement failed, using raw prompt:', error);
      }
    }

    return basePrompt;
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
  // Generation Status (Simplified - Modal is synchronous)
  // ---------------------------------------------------------------------------

  /**
   * Check for episodes in 'generating' status and update if needed.
   * Since Modal returns videos synchronously, this mainly handles edge cases
   * where generation started but the episode status wasn't updated.
   */
  async checkPendingGenerations(): Promise<{ updated: number; skipped: boolean }> {
    // Skip if not configured
    if (!this.isConfigured) {
      return { updated: 0, skipped: true };
    }

    // Find episodes in 'generating' status that might need status updates
    const generatingEpisodes = await prisma.episode.findMany({
      where: { status: 'generating' },
      include: {
        clip_variants: true,
      },
      take: 10,
    });

    let updated = 0;

    for (const episode of generatingEpisodes) {
      // Count completed variants (have video_url)
      const completedVariants = episode.clip_variants.filter(v => v.video_url && v.video_url.length > 0);
      
      if (completedVariants.length >= 4) {
        // All variants complete - move to clip_voting
        await prisma.episode.update({
          where: { id: episode.id },
          data: { status: 'clip_voting' },
        });
        
        // Update series status
        await prisma.limitedSeries.update({
          where: { id: episode.series_id },
          data: { status: 'active', episode_count: 1 },
        });
        
        console.log(`[EpisodeProduction] Episode ${episode.id} moved to clip_voting`);
        updated++;
      } else if (episode.clip_variants.length >= 4 && completedVariants.length === 0) {
        // All 4 variants created but none have URLs - might be failed
        // Check if they're older than 30 minutes (generation timeout)
        const createdAt = episode.clip_variants[0]?.created_at;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        if (createdAt && new Date(createdAt) < thirtyMinutesAgo) {
          await prisma.episode.update({
            where: { id: episode.id },
            data: { status: 'failed' },
          });
          console.log(`[EpisodeProduction] Episode ${episode.id} marked as failed (timeout)`);
          updated++;
        }
      }
    }

    return { updated, skipped: false };
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

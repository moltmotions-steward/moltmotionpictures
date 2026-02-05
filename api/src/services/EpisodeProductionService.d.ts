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
import { LimitedSeries, Episode } from '@prisma/client';
import { GradientClient } from './GradientClient';
import { SpacesClient } from './SpacesClient';
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
        location_anchors?: Array<{
            id: string;
            name: string;
            visual: string;
        }>;
        character_anchors?: Array<{
            id: string;
            name: string;
            visual: string;
        }>;
        do_not_change?: string[];
    };
    shots: Array<{
        prompt: {
            camera: string;
            scene: string;
            motion?: string;
        };
        gen_clip_seconds: number;
        duration_seconds: number;
        edit_extend_strategy: string;
        audio?: {
            type: string;
            description?: string;
            voice_id?: string;
            dialogue?: {
                speaker: string;
                line: string;
            };
        };
        audio_type?: string;
        narration?: string;
        dialogue?: {
            speaker: string;
            line: string;
        };
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
export declare class EpisodeProductionService {
    private gradient;
    private veo;
    private spaces;
    private readonly isConfigured;
    private readonly defaultTtsTimeoutMs;
    constructor(gradient?: GradientClient, spaces?: SpacesClient);
    /**
     * Finds all pending LimitedSeries and initiates clip generation.
     * Called by the cron job.
     */
    processPendingProductions(): Promise<{
        processed: number;
        failed: number;
        skipped: boolean;
    }>;
    /**
     * Creates the pilot episode (Episode 1) for a new series.
     */
    createPilotEpisode(series: LimitedSeries, scriptData: ScriptData | null): Promise<Episode>;
    /**
     * Calculate number of frames based on desired duration.
     * Mochi generates at 24fps.
     */
    private calculateFrames;
    /**
     * Initiates generation of 4 clip variants for an episode.
     * Uses different shot sequences and styles for variety.
     * Now uses Modal + Mochi for text-to-video generation.
     */
    initiateClipGeneration(episode: Episode, series: LimitedSeries, scriptData: ScriptData | null): Promise<ClipGenerationResult[]>;
    private maybeGenerateEpisodeTts;
    private extractNarrationText;
    /**
     * Builds a video generation prompt from series/script data.
     * Uses Gradient LLM for refinement if available, otherwise builds directly.
     */
    private buildVideoPrompt;
    /**
     * Generates 4 stylistic variants of the base prompt.
     */
    private generatePromptVariants;
    /**
     * Check for episodes in 'generating' status and update if needed.
     * Since Modal returns videos synchronously, this mainly handles edge cases
     * where generation started but the episode status wasn't updated.
     */
    checkPendingGenerations(): Promise<{
        updated: number;
        skipped: boolean;
    }>;
}
export declare function getEpisodeProductionService(): EpisodeProductionService;
export default EpisodeProductionService;
//# sourceMappingURL=EpisodeProductionService.d.ts.map
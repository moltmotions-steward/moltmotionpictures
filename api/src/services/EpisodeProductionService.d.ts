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
            description: string;
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
    private spaces;
    private readonly isConfigured;
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
     * Initiates generation of 4 clip variants for an episode.
     * Uses different shot sequences and styles for variety.
     */
    initiateClipGeneration(episode: Episode, series: LimitedSeries, scriptData: ScriptData | null): Promise<ClipGenerationResult[]>;
    /**
     * Builds a video generation prompt from series/script data.
     */
    private buildVideoPrompt;
    /**
     * Generates 4 stylistic variants of the base prompt.
     */
    private generatePromptVariants;
    /**
     * Tracks a video generation for later polling.
     * Stores in a simple key-value structure (could be Redis in production).
     */
    private generationTracker;
    private trackGeneration;
    /**
     * Polls pending generations and updates clip variants when complete.
     * Called by the cron job.
     */
    pollPendingGenerations(): Promise<{
        completed: number;
        failed: number;
        skipped: boolean;
    }>;
    /**
     * Downloads a video from URL and stores in DO Spaces.
     */
    private storeClipAsset;
}
export declare function getEpisodeProductionService(): EpisodeProductionService;
export default EpisodeProductionService;
//# sourceMappingURL=EpisodeProductionService.d.ts.map
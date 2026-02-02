"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpisodeProductionService = void 0;
exports.getEpisodeProductionService = getEpisodeProductionService;
const client_1 = require("@prisma/client");
const GradientClient_1 = require("./GradientClient");
const SpacesClient_1 = require("./SpacesClient");
const ModalVideoClient_1 = require("./ModalVideoClient");
const prisma = new client_1.PrismaClient();
// =============================================================================
// Episode Production Service
// =============================================================================
class EpisodeProductionService {
    gradient;
    modalVideo;
    spaces;
    isConfigured;
    constructor(gradient, spaces, modalVideo) {
        // Gradient client for LLM calls (prompt refinement)
        try {
            this.gradient = gradient || (0, GradientClient_1.getGradientClient)();
        }
        catch {
            this.gradient = null;
            console.warn('[EpisodeProduction] GradientClient not configured - prompt refinement disabled');
        }
        // Modal Video client for actual video generation
        try {
            this.modalVideo = modalVideo || (0, ModalVideoClient_1.getModalVideoClient)();
        }
        catch {
            this.modalVideo = null;
            console.warn('[EpisodeProduction] ModalVideoClient not configured - video generation disabled');
        }
        try {
            this.spaces = spaces || (0, SpacesClient_1.getSpacesClient)();
        }
        catch {
            this.spaces = null;
            console.warn('[EpisodeProduction] SpacesClient not configured - asset storage disabled');
        }
        // We need Modal for video gen and Spaces for storage; Gradient is optional for prompt refinement
        this.isConfigured = this.modalVideo !== null && this.spaces !== null;
    }
    // ---------------------------------------------------------------------------
    // Main Entry Point: Process Pending Series
    // ---------------------------------------------------------------------------
    /**
     * Finds all pending LimitedSeries and initiates clip generation.
     * Called by the cron job.
     */
    async processPendingProductions() {
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
                let scriptData = null;
                const sourceScript = series.scripts[0];
                if (sourceScript?.script_data) {
                    try {
                        scriptData = JSON.parse(sourceScript.script_data);
                    }
                    catch {
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
            }
            catch (error) {
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
    async createPilotEpisode(series, scriptData) {
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
     * Mochi generates at 24fps.
     */
    calculateFrames(durationSeconds) {
        // Clamp to reasonable range: 2-5 seconds
        const clampedDuration = Math.max(2, Math.min(5, durationSeconds));
        return Math.round(clampedDuration * 24);
    }
    /**
     * Initiates generation of 4 clip variants for an episode.
     * Uses different shot sequences and styles for variety.
     * Now uses Modal + Mochi for text-to-video generation.
     */
    async initiateClipGeneration(episode, series, scriptData) {
        const results = [];
        const VARIANT_COUNT = 4;
        // Generate base prompt from script data
        const basePrompt = await this.buildVideoPrompt(series, scriptData);
        // Generate 4 variants with different stylistic approaches
        const variants = this.generatePromptVariants(basePrompt, scriptData);
        // Calculate frames based on script data (default ~3.5s)
        const requestedClipSeconds = scriptData?.shots?.[0]?.gen_clip_seconds || 3.5;
        const numFrames = this.calculateFrames(requestedClipSeconds);
        for (let i = 0; i < VARIANT_COUNT; i++) {
            const prompt = variants[i] || basePrompt;
            const seed = Date.now() + i;
            const startTime = Date.now();
            try {
                console.log(`[EpisodeProduction] Generating variant ${i + 1} for episode ${episode.id}`);
                // Generate video using Modal + Mochi
                const generation = await this.modalVideo.generateShot(prompt, {
                    aspectRatio: '16:9',
                    seed: seed, // Different seed per variant for variety
                });
                const generationTimeMs = Date.now() - startTime;
                // Upload video to Spaces storage
                const videoBuffer = Buffer.from(generation.video_base64, 'base64');
                const uploadResult = await this.spaces.upload({
                    key: `episodes/${episode.id}/variant-${i + 1}.mp4`,
                    body: videoBuffer,
                    contentType: 'video/mp4',
                    metadata: {
                        episodeId: episode.id,
                        variantNumber: String(i + 1),
                        prompt: prompt.slice(0, 500), // Truncate for metadata limits
                        generatedBy: 'mochi-modal',
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
                        model_used: 'mochi-1-preview',
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
            }
            catch (error) {
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
                        model_used: 'mochi-1-preview',
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
        }
        return results;
    }
    /**
     * Builds a video generation prompt from series/script data.
     * Uses Gradient LLM for refinement if available, otherwise builds directly.
     */
    async buildVideoPrompt(series, scriptData) {
        let basePrompt;
        if (!scriptData) {
            // Simple fallback from title/logline
            basePrompt = `A cinematic ${series.genre} film scene. ${series.logline}. 
Professional cinematography, dramatic lighting, high production value.`;
        }
        else {
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
            }
            catch (error) {
                console.warn('[EpisodeProduction] Prompt refinement failed, using raw prompt:', error);
            }
        }
        return basePrompt;
    }
    /**
     * Generates 4 stylistic variants of the base prompt.
     */
    generatePromptVariants(basePrompt, scriptData) {
        const variants = [];
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
    async checkPendingGenerations() {
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
            }
            else if (episode.clip_variants.length >= 4 && completedVariants.length === 0) {
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
exports.EpisodeProductionService = EpisodeProductionService;
// =============================================================================
// Singleton Export
// =============================================================================
let serviceInstance = null;
function getEpisodeProductionService() {
    if (!serviceInstance) {
        serviceInstance = new EpisodeProductionService();
    }
    return serviceInstance;
}
exports.default = EpisodeProductionService;
//# sourceMappingURL=EpisodeProductionService.js.map
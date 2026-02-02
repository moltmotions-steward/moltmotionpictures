"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpisodeProductionService = void 0;
exports.getEpisodeProductionService = getEpisodeProductionService;
const client_1 = require("@prisma/client");
const GradientClient_1 = require("./GradientClient");
const SpacesClient_1 = require("./SpacesClient");
const prisma = new client_1.PrismaClient();
// =============================================================================
// Episode Production Service
// =============================================================================
class EpisodeProductionService {
    gradient;
    spaces;
    isConfigured;
    normalizeLumaClipSeconds(requestedSeconds) {
        if (requestedSeconds === 10)
            return 10;
        if (requestedSeconds === 5)
            return 5;
        if (typeof requestedSeconds !== 'number' || !Number.isFinite(requestedSeconds))
            return 10;
        return requestedSeconds <= 5 ? 5 : 10;
    }
    constructor(gradient, spaces) {
        // Gracefully handle missing API keys
        try {
            this.gradient = gradient || (0, GradientClient_1.getGradientClient)();
        }
        catch {
            this.gradient = null;
            console.warn('[EpisodeProduction] GradientClient not configured - clip generation disabled');
        }
        try {
            this.spaces = spaces || (0, SpacesClient_1.getSpacesClient)();
        }
        catch {
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
     * Initiates generation of 4 clip variants for an episode.
     * Uses different shot sequences and styles for variety.
     */
    async initiateClipGeneration(episode, series, scriptData) {
        const results = [];
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
                const generation = await this.gradient.generateShot(prompt, {
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
            }
            catch (error) {
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
    async buildVideoPrompt(series, scriptData) {
        if (!scriptData) {
            // Fallback to generating from title/logline
            return await this.gradient.refineVideoPrompt(`A ${series.genre} film scene. ${series.logline}`);
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
        return await this.gradient.refineVideoPrompt(basePrompt);
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
    /**
     * Tracks a video generation for later polling.
     * Stores in a simple key-value structure (could be Redis in production).
     */
    generationTracker = new Map();
    async trackGeneration(clipVariantId, generationId) {
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
    async pollPendingGenerations() {
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
                if (variant.video_url)
                    continue;
                const generationId = this.generationTracker.get(variant.id);
                if (!generationId) {
                    console.warn(`[EpisodeProduction] No generation ID for variant ${variant.id}`);
                    continue;
                }
                try {
                    const status = await this.gradient.getVideoStatus(generationId);
                    if (status.status === 'completed' && status.video_url) {
                        // Download and store in Spaces
                        const storedUrl = await this.storeClipAsset(episode.series_id, episode.id, variant.id, status.video_url);
                        await prisma.clipVariant.update({
                            where: { id: variant.id },
                            data: {
                                video_url: storedUrl,
                                thumbnail_url: status.thumbnail_url || null,
                            },
                        });
                        completed++;
                    }
                    else if (status.status === 'failed') {
                        anyFailed = true;
                        failed++;
                    }
                    else {
                        // Still generating
                        allComplete = false;
                    }
                }
                catch (error) {
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
    async storeClipAsset(seriesId, episodeId, variantId, sourceUrl) {
        const path = `series/${seriesId}/episodes/${episodeId}/clips/${variantId}.mp4`;
        const asset = await this.spaces.uploadFromUrl(sourceUrl, path, {
            productionId: seriesId, // Use seriesId as productionId
            assetType: 'video',
            generatedBy: 'luma-dream-machine',
            agentId: '', // System-generated
            createdAt: new Date().toISOString(),
        });
        return asset.url;
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
"use strict";
/**
 * Modal Video Generation Client
 *
 * TypeScript client for calling the Modal-hosted Mochi video generation endpoint.
 * This replaces the DigitalOcean Gradient video generation (which doesn't exist).
 *
 * Endpoint: https://rikc-speak--molt-video-gen-generate-video.modal.run
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalVideoClient = exports.ModalVideoError = void 0;
exports.getModalVideoClient = getModalVideoClient;
class ModalVideoError extends Error {
    statusCode;
    details;
    constructor(message, statusCode, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ModalVideoError';
    }
}
exports.ModalVideoError = ModalVideoError;
// =============================================================================
// Client Class
// =============================================================================
const DEFAULT_ENDPOINT = 'https://rikc-speak--molt-video-gen-generate-video.modal.run';
const DEFAULT_HEALTH_ENDPOINT = 'https://rikc-speak--molt-video-gen-health.modal.run';
const DEFAULT_TIMEOUT = 600000; // 10 minutes - video generation takes time
class ModalVideoClient {
    endpoint;
    healthEndpoint;
    timeout;
    constructor(config = {}) {
        this.endpoint = config.endpoint || process.env.MODAL_VIDEO_ENDPOINT || DEFAULT_ENDPOINT;
        this.healthEndpoint = config.healthEndpoint || process.env.MODAL_HEALTH_ENDPOINT || DEFAULT_HEALTH_ENDPOINT;
        this.timeout = config.timeout || DEFAULT_TIMEOUT;
    }
    // ---------------------------------------------------------------------------
    // Health Check
    // ---------------------------------------------------------------------------
    async healthCheck() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for health
        try {
            const response = await fetch(this.healthEndpoint, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new ModalVideoError(`Health check failed: ${response.status}`, response.status);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof ModalVideoError)
                throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new ModalVideoError('Health check timed out', 408);
            }
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // Video Generation
    // ---------------------------------------------------------------------------
    /**
     * Generate a video from a text prompt.
     *
     * @param request - Video generation parameters
     * @returns Video data including base64-encoded video bytes
     *
     * @example
     * ```typescript
     * const client = new ModalVideoClient();
     * const result = await client.generateVideo({
     *   prompt: "A cinematic shot of a futuristic city at sunset",
     *   num_frames: 84,  // ~3.5 seconds
     * });
     * // result.video_base64 contains the MP4 video
     * ```
     */
    async generateVideo(request) {
        if (!request.prompt || request.prompt.trim().length === 0) {
            throw new ModalVideoError('Prompt is required', 400);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        console.log(`[ModalVideo] Generating video for prompt: ${request.prompt.slice(0, 100)}...`);
        const startTime = Date.now();
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negative_prompt || 'low quality, blurry, distorted',
                    num_frames: request.num_frames || 84,
                    fps: request.fps || 24,
                    width: request.width || 848,
                    height: request.height || 480,
                    num_inference_steps: request.num_inference_steps || 50,
                    guidance_scale: request.guidance_scale || 4.5,
                    seed: request.seed ?? null,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new ModalVideoError(errorBody.error || `HTTP ${response.status}`, response.status, errorBody);
            }
            const result = await response.json();
            const elapsedMs = Date.now() - startTime;
            console.log(`[ModalVideo] Video generated in ${(elapsedMs / 1000).toFixed(1)}s`);
            console.log(`[ModalVideo]   Duration: ${result.duration_seconds}s, Resolution: ${result.width}x${result.height}`);
            return result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof ModalVideoError)
                throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new ModalVideoError('Video generation timed out', 408);
            }
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // Convenience Methods
    // ---------------------------------------------------------------------------
    /**
     * Generate a short clip (suitable for social media / previews).
     * ~2 seconds, optimized for fast generation.
     */
    async generateClip(prompt, options = {}) {
        return this.generateVideo({
            prompt,
            negative_prompt: options.negativePrompt,
            num_frames: 48, // ~2 seconds at 24fps
            num_inference_steps: 30, // Faster but slightly lower quality
            seed: options.seed,
        });
    }
    /**
     * Generate a standard shot (~3.5 seconds).
     * Good for episode clips and voting variants.
     */
    async generateShot(prompt, options = {}) {
        // Calculate dimensions based on aspect ratio
        let width = 848;
        let height = 480;
        if (options.aspectRatio === '9:16') {
            width = 480;
            height = 848;
        }
        else if (options.aspectRatio === '1:1') {
            width = 512;
            height = 512;
        }
        return this.generateVideo({
            prompt,
            negative_prompt: options.negativePrompt,
            num_frames: 84, // ~3.5 seconds
            width,
            height,
            seed: options.seed,
        });
    }
    /**
     * Generate a longer sequence (~5 seconds).
     * Higher quality settings, takes longer.
     */
    async generateSequence(prompt, options = {}) {
        return this.generateVideo({
            prompt,
            negative_prompt: options.negativePrompt,
            num_frames: 120, // ~5 seconds at 24fps
            num_inference_steps: 50,
            guidance_scale: 5.0,
            seed: options.seed,
        });
    }
}
exports.ModalVideoClient = ModalVideoClient;
// =============================================================================
// Singleton Export
// =============================================================================
let clientInstance = null;
function getModalVideoClient() {
    if (!clientInstance) {
        clientInstance = new ModalVideoClient();
    }
    return clientInstance;
}
exports.default = ModalVideoClient;
//# sourceMappingURL=ModalVideoClient.js.map
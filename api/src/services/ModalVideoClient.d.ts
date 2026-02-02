/**
 * Modal Video Generation Client
 *
 * TypeScript client for calling the Modal-hosted Mochi video generation endpoint.
 * This replaces the DigitalOcean Gradient video generation (which doesn't exist).
 *
 * Endpoint: https://rikc-speak--molt-video-gen-generate-video.modal.run
 */
export interface VideoGenerationRequest {
    prompt: string;
    negative_prompt?: string;
    num_frames?: number;
    fps?: number;
    width?: number;
    height?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    seed?: number | null;
}
export interface VideoGenerationResponse {
    video_base64: string;
    duration_seconds: number;
    width: number;
    height: number;
    fps: number;
    num_frames: number;
    seed: number;
    generation_time_seconds: number;
    prompt: string;
}
export interface ModalHealthResponse {
    status: string;
    service: string;
    model: string;
}
export interface ModalVideoConfig {
    endpoint?: string;
    healthEndpoint?: string;
    timeout?: number;
}
export declare class ModalVideoError extends Error {
    readonly statusCode: number;
    readonly details?: unknown | undefined;
    constructor(message: string, statusCode: number, details?: unknown | undefined);
}
export declare class ModalVideoClient {
    private readonly endpoint;
    private readonly healthEndpoint;
    private readonly timeout;
    constructor(config?: ModalVideoConfig);
    healthCheck(): Promise<ModalHealthResponse>;
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
    generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;
    /**
     * Generate a short clip (suitable for social media / previews).
     * ~2 seconds, optimized for fast generation.
     */
    generateClip(prompt: string, options?: {
        negativePrompt?: string;
        seed?: number;
    }): Promise<VideoGenerationResponse>;
    /**
     * Generate a standard shot (~3.5 seconds).
     * Good for episode clips and voting variants.
     */
    generateShot(prompt: string, options?: {
        negativePrompt?: string;
        aspectRatio?: '16:9' | '9:16' | '1:1';
        seed?: number;
    }): Promise<VideoGenerationResponse>;
    /**
     * Generate a longer sequence (~5 seconds).
     * Higher quality settings, takes longer.
     */
    generateSequence(prompt: string, options?: {
        negativePrompt?: string;
        seed?: number;
    }): Promise<VideoGenerationResponse>;
}
export declare function getModalVideoClient(): ModalVideoClient;
export default ModalVideoClient;
//# sourceMappingURL=ModalVideoClient.d.ts.map
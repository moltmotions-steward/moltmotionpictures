/**
 * Modal Video Generation Client
 *
 * TypeScript client for calling the Modal-hosted LTX-2 video generation endpoint.
 * Uses Lightricks LTX-2 (19B) for synchronized audio-video generation.
 *
 * Endpoint: https://rikc-speak--molt-ltx2-gen-ltx-2-generator-generate.modal.run
 */
export interface VideoGenerationRequest {
    prompt: string;
    audio_text?: string | null;
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
    duration: number;
    wall_clock_time: number;
    width: number;
    height: number;
    seed: number;
    model: string;
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
     * Generate a video from a text prompt using LTX-2.
     *
     * @param request - Video generation parameters
     * @returns Video data including base64-encoded video bytes
     *
     * @example
     * ```typescript
     * const client = new ModalVideoClient();
     * const result = await client.generateVideo({
     *   prompt: "A cinematic shot of a futuristic city at sunset",
     *   audio_text: "Welcome to the city of tomorrow.",
     *   num_frames: 121,  // ~5 seconds
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
        audioText?: string;
        seed?: number;
    }): Promise<VideoGenerationResponse>;
    /**
     * Generate a standard shot (~5 seconds).
     * Good for episode clips and voting variants.
     */
    generateShot(prompt: string, options?: {
        negativePrompt?: string;
        audioText?: string;
        aspectRatio?: '16:9' | '9:16' | '1:1';
        seed?: number;
    }): Promise<VideoGenerationResponse>;
    /**
     * Generate a longer sequence (~8 seconds).
     * Higher quality settings, takes longer.
     */
    generateSequence(prompt: string, options?: {
        negativePrompt?: string;
        audioText?: string;
        seed?: number;
    }): Promise<VideoGenerationResponse>;
    /**
     * Generate a video with synchronized audio narration.
     * Uses LTX-2's native audio-video sync capabilities.
     */
    generateWithAudio(prompt: string, audioText: string, options?: {
        negativePrompt?: string;
        numFrames?: number;
        seed?: number;
    }): Promise<VideoGenerationResponse>;
}
export declare function getModalVideoClient(): ModalVideoClient;
export default ModalVideoClient;
//# sourceMappingURL=ModalVideoClient.d.ts.map
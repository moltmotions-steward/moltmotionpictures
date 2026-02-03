/**
 * DigitalOcean Gradient AI Client
 *
 * Typed client for the DO Serverless Inference API.
 * Handles LLM completions, image generation (FLUX.1), and video generation (Luma).
 *
 * @see https://docs.digitalocean.com/products/gradient-ai/
 */
import type { ChatCompletionRequest, ChatCompletionResponse, GradientModel, ImageGenerationRequest, ImageGenerationResponse, VideoGenerationRequest, VideoGenerationResponse } from '../types/gradient';
interface GradientClientConfig {
    apiKey: string;
    endpoint?: string;
    timeout?: number;
}
export declare class GradientClient {
    private readonly apiKey;
    private readonly endpoint;
    private readonly timeout;
    constructor(config: GradientClientConfig);
    private request;
    listModels(): Promise<{
        data: Array<{
            id: string;
            object: string;
        }>;
    }>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    /**
     * Convenience method for simple prompts
     */
    prompt(message: string, options?: {
        model?: GradientModel;
        systemPrompt?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<string>;
    generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
    /**
     * Generate a movie Scripter using FLUX.1
     */
    generateScripter(prompt: string, options?: {
        negativePrompt?: string;
        width?: number;
        height?: number;
        model?: 'flux.1-schnell' | 'flux.1-dev';
    }): Promise<ImageGenerationResponse>;
    private normalizeLumaDurationSeconds;
    generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;
    /**
     * Check the status of a video generation job
     */
    getVideoStatus(generationId: string): Promise<VideoGenerationResponse>;
    /**
     * Generate a shot with camera motion
     */
    generateShot(prompt: string, options?: {
        negativePrompt?: string;
        aspectRatio?: '16:9' | '9:16' | '1:1';
        duration?: number;
        cameraMotion?: string;
    }): Promise<VideoGenerationResponse>;
    /**
     * Refine a rough prompt into a detailed video generation prompt
     */
    refineVideoPrompt(roughPrompt: string): Promise<string>;
    /**
     * Generate a Scripter prompt from a movie logline
     */
    generateScripterPrompt(title: string, logline: string, genre: string): Promise<string>;
}
export declare function getGradientClient(): GradientClient;
export default GradientClient;
//# sourceMappingURL=GradientClient.d.ts.map
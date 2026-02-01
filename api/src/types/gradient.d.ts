/**
 * DigitalOcean Gradient AI Platform Types
 *
 * Type definitions for the DO Serverless Inference API
 * Endpoint: https://inference.do-ai.run
 *
 * @see https://docs.digitalocean.com/products/gradient-ai/
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | ContentPart[];
}
export interface ContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
    cache_control?: CacheControl;
}
export interface CacheControl {
    type: 'ephemeral';
    ttl: '5m' | '1h';
}
export interface ChatCompletionRequest {
    model: GradientModel;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
    n?: number;
}
export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: ChatChoice[];
    usage: TokenUsage;
    service_tier: string | null;
}
export interface ChatChoice {
    index: number;
    message: {
        role: string;
        content: string;
        refusal: string | null;
        audio: unknown | null;
    };
    logprobs: unknown | null;
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}
export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cache_created_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: {
        ephemeral_1h_input_tokens: number;
        ephemeral_5m_input_tokens: number;
    };
}
export type GradientModel = 'llama3.3-70b-instruct' | 'llama3.1-8b-instruct' | 'llama3.1-70b-instruct' | 'llama3.1-405b-instruct' | 'mistral-nemo-instruct-2407' | 'qwen2.5-coder-32b-instruct' | 'flux.1-schnell' | 'flux.1-dev' | 'llama3.2-90b-vision-instruct' | 'luma-dream-machine';
export interface ModelInfo {
    id: GradientModel;
    name: string;
    type: 'llm' | 'image' | 'video' | 'vision';
    contextWindow?: number;
    maxOutputTokens?: number;
    pricePerMToken?: {
        input: number;
        output: number;
    };
}
export declare const GRADIENT_MODELS: Record<GradientModel, ModelInfo>;
export interface ImageGenerationRequest {
    model: 'flux.1-schnell' | 'flux.1-dev';
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    guidance?: number;
    seed?: number;
    num_images?: number;
}
export interface ImageGenerationResponse {
    images: GeneratedImage[];
    timings?: {
        inference: number;
    };
}
export interface GeneratedImage {
    url: string;
    content_type: string;
    width: number;
    height: number;
    seed: number;
}
export interface VideoGenerationRequest {
    model: 'luma-dream-machine';
    prompt: string;
    negative_prompt?: string;
    aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
    duration?: number;
    loop?: boolean;
    keyframes?: VideoKeyframe[];
    camera_motion?: CameraMotion;
}
export interface VideoKeyframe {
    type: 'image' | 'generation';
    url?: string;
    prompt?: string;
    frame?: 'first' | 'last';
}
export type CameraMotion = 'static' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'orbit_left' | 'orbit_right' | 'crane_up' | 'crane_down';
export interface VideoGenerationResponse {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    error?: string;
}
export interface GradientApiError {
    error: {
        message: string;
        type: string;
        code: string;
        param?: string;
    };
}
export declare class GradientError extends Error {
    readonly code: string;
    readonly type: string;
    readonly statusCode: number;
    constructor(message: string, code: string, type: string, statusCode: number);
}
//# sourceMappingURL=gradient.d.ts.map
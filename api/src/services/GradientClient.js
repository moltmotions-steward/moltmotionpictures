"use strict";
/**
 * DigitalOcean Gradient AI Client
 *
 * Typed client for the DO Serverless Inference API.
 * Handles LLM completions, image generation (FLUX.1), and video generation (Luma).
 *
 * @see https://docs.digitalocean.com/products/gradient-ai/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradientClient = void 0;
exports.getGradientClient = getGradientClient;
const gradient_1 = require("../types/gradient");
const DEFAULT_ENDPOINT = 'https://inference.do-ai.run';
const DEFAULT_TIMEOUT = 120000; // 2 minutes for video generation
// =============================================================================
// Client Class
// =============================================================================
class GradientClient {
    apiKey;
    endpoint;
    timeout;
    constructor(config) {
        if (!config.apiKey) {
            throw new Error('GradientClient requires an API key');
        }
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint || DEFAULT_ENDPOINT;
        this.timeout = config.timeout || DEFAULT_TIMEOUT;
    }
    // ---------------------------------------------------------------------------
    // HTTP Layer
    // ---------------------------------------------------------------------------
    async request(path, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(`${this.endpoint}${path}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new gradient_1.GradientError(errorBody.error?.message || `HTTP ${response.status}`, errorBody.error?.code || 'unknown_error', errorBody.error?.type || 'api_error', response.status);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof gradient_1.GradientError)
                throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new gradient_1.GradientError('Request timed out', 'timeout', 'network_error', 408);
            }
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // Models API
    // ---------------------------------------------------------------------------
    async listModels() {
        return this.request('/v1/models', { method: 'GET' });
    }
    // ---------------------------------------------------------------------------
    // Chat Completions API (LLMs)
    // ---------------------------------------------------------------------------
    async chatCompletion(request) {
        return this.request('/v1/chat/completions', {
            method: 'Script',
            body: JSON.stringify(request),
        });
    }
    /**
     * Convenience method for simple prompts
     */
    async prompt(message, options = {}) {
        const messages = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: message });
        const response = await this.chatCompletion({
            model: options.model || 'llama3.3-70b-instruct',
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2048,
        });
        return response.choices[0]?.message?.content || '';
    }
    // ---------------------------------------------------------------------------
    // Image Generation API (FLUX.1)
    // ---------------------------------------------------------------------------
    async generateImage(request) {
        // FLUX.1 uses the same chat completions endpoint with special formatting
        // The response includes base64 images or URLs depending on the model
        return this.request('/v1/images/generations', {
            method: 'Script',
            body: JSON.stringify({
                model: request.model,
                prompt: request.prompt,
                negative_prompt: request.negative_prompt,
                size: `${request.width || 1024}x${request.height || 1024}`,
                n: request.num_images || 1,
                quality: request.steps ? 'hd' : 'standard',
                response_format: 'url',
            }),
        });
    }
    /**
     * Generate a movie Scripter using FLUX.1
     */
    async generateScripter(prompt, options = {}) {
        return this.generateImage({
            model: options.model || 'flux.1-schnell',
            prompt,
            negative_prompt: options.negativePrompt,
            width: options.width || 2048,
            height: options.height || 3072, // 2:3 aspect ratio for Scripters
        });
    }
    // ---------------------------------------------------------------------------
    // Video Generation API (Luma Dream Machine)
    // ---------------------------------------------------------------------------
    normalizeLumaDurationSeconds(duration) {
        if (duration === 10)
            return 10;
        if (duration === 5)
            return 5;
        if (typeof duration !== 'number' || !Number.isFinite(duration))
            return 5;
        return duration <= 5 ? 5 : 10;
    }
    async generateVideo(request) {
        const durationSeconds = this.normalizeLumaDurationSeconds(request.duration);
        // Luma Dream Machine endpoint
        return this.request('/v1/video/generations', {
            method: 'Script',
            body: JSON.stringify({
                model: 'luma-dream-machine',
                prompt: request.prompt,
                negative_prompt: request.negative_prompt,
                aspect_ratio: request.aspect_ratio || '16:9',
                duration: durationSeconds,
                loop: request.loop || false,
                camera_motion: request.camera_motion,
                keyframes: request.keyframes,
            }),
        });
    }
    /**
     * Check the status of a video generation job
     */
    async getVideoStatus(generationId) {
        return this.request(`/v1/video/generations/${generationId}`, {
            method: 'GET',
        });
    }
    /**
     * Generate a shot with camera motion
     */
    async generateShot(prompt, options = {}) {
        return this.generateVideo({
            model: 'luma-dream-machine',
            prompt,
            negative_prompt: options.negativePrompt,
            aspect_ratio: options.aspectRatio || '16:9',
            duration: options.duration || 5,
            camera_motion: options.cameraMotion,
        });
    }
    // ---------------------------------------------------------------------------
    // Prompt Engineering Helpers
    // ---------------------------------------------------------------------------
    /**
     * Refine a rough prompt into a detailed video generation prompt
     */
    async refineVideoPrompt(roughPrompt) {
        const systemPrompt = `You are a cinematographer and prompt engineer for AI video generation.
Your task is to transform rough scene descriptions into detailed, cinematic prompts optimized for Luma Dream Machine.

Guidelines:
- Add specific camera angles and movements
- Describe lighting conditions precisely
- Include atmospheric details (fog, dust, particles)
- Specify the visual style (film stock, color grading)
- Keep prompts under 200 words
- Focus on motion and temporal changes
- Avoid abstract concepts - describe what is visually happening

Output ONLY the refined prompt, no explanations.`;
        return this.prompt(roughPrompt, {
            systemPrompt,
            temperature: 0.8,
            maxTokens: 300,
        });
    }
    /**
     * Generate a Scripter prompt from a movie logline
     */
    async generateScripterPrompt(title, logline, genre) {
        const systemPrompt = `You are a movie Scripter designer and prompt engineer for AI image generation.
Your task is to create detailed prompts for FLUX.1 that will generate compelling movie Scripters.

Guidelines:
- Describe the key visual elements and composition
- Specify the art style and color palette
- Include typography style hints
- Reference cinematic lighting
- Avoid text in the image - describe visual metaphors instead
- Keep prompts under 150 words

Output ONLY the prompt, no explanations.`;
        const userPrompt = `Create a Scripter prompt for:
Title: ${title}
Genre: ${genre}
Logline: ${logline}`;
        return this.prompt(userPrompt, {
            systemPrompt,
            temperature: 0.9,
            maxTokens: 200,
        });
    }
}
exports.GradientClient = GradientClient;
// =============================================================================
// Singleton Export
// =============================================================================
let clientInstance = null;
function getGradientClient() {
    if (!clientInstance) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const config = require('../config').default || require('../config');
        if (!config.doGradient?.apiKey) {
            throw new Error('DO_GRADIENT_API_KEY environment variable is required');
        }
        clientInstance = new GradientClient({
            apiKey: config.doGradient.apiKey,
            endpoint: config.doGradient.endpoint,
        });
    }
    return clientInstance;
}
exports.default = GradientClient;
//# sourceMappingURL=GradientClient.js.map
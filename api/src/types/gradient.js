"use strict";
/**
 * DigitalOcean Gradient AI Platform Types
 *
 * Type definitions for the DO Serverless Inference API
 * Endpoint: https://inference.do-ai.run
 *
 * @see https://docs.digitalocean.com/products/gradient-ai/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradientError = exports.GRADIENT_MODELS = void 0;
exports.GRADIENT_MODELS = {
    'llama3.3-70b-instruct': {
        id: 'llama3.3-70b-instruct',
        name: 'Llama 3.3 Instruct 70B',
        type: 'llm',
        contextWindow: 128000,
        maxOutputTokens: 4096,
    },
    'llama3.1-8b-instruct': {
        id: 'llama3.1-8b-instruct',
        name: 'Llama 3.1 Instruct 8B',
        type: 'llm',
        contextWindow: 128000,
        maxOutputTokens: 4096,
    },
    'llama3.1-70b-instruct': {
        id: 'llama3.1-70b-instruct',
        name: 'Llama 3.1 Instruct 70B',
        type: 'llm',
        contextWindow: 128000,
        maxOutputTokens: 4096,
    },
    'llama3.1-405b-instruct': {
        id: 'llama3.1-405b-instruct',
        name: 'Llama 3.1 Instruct 405B',
        type: 'llm',
        contextWindow: 128000,
        maxOutputTokens: 4096,
    },
    'mistral-nemo-instruct-2407': {
        id: 'mistral-nemo-instruct-2407',
        name: 'Mistral Nemo Instruct',
        type: 'llm',
        contextWindow: 128000,
        maxOutputTokens: 4096,
    },
    'qwen2.5-coder-32b-instruct': {
        id: 'qwen2.5-coder-32b-instruct',
        name: 'Qwen 2.5 Coder 32B',
        type: 'llm',
        contextWindow: 32768,
        maxOutputTokens: 4096,
    },
    'flux.1-schnell': {
        id: 'flux.1-schnell',
        name: 'FLUX.1 Schnell',
        type: 'image',
    },
    'flux.1-dev': {
        id: 'flux.1-dev',
        name: 'FLUX.1 Dev',
        type: 'image',
    },
    'llama3.2-90b-vision-instruct': {
        id: 'llama3.2-90b-vision-instruct',
        name: 'Llama 3.2 Vision 90B',
        type: 'vision',
        contextWindow: 128000,
        maxOutputTokens: 4096,
    },
    'luma-dream-machine': {
        id: 'luma-dream-machine',
        name: 'Luma Dream Machine',
        type: 'video',
    },
    'fal-ai/elevenlabs/tts/multilingual-v2': {
        id: 'fal-ai/elevenlabs/tts/multilingual-v2',
        name: 'ElevenLabs TTS Multilingual v2',
        type: 'audio',
    },
    'fal-ai/stable-audio-25/text-to-audio': {
        id: 'fal-ai/stable-audio-25/text-to-audio',
        name: 'Stable Audio 2.5',
        type: 'audio',
    },
};
class GradientError extends Error {
    code;
    type;
    statusCode;
    constructor(message, code, type, statusCode) {
        super(message);
        this.code = code;
        this.type = type;
        this.statusCode = statusCode;
        this.name = 'GradientError';
    }
}
exports.GradientError = GradientError;
//# sourceMappingURL=gradient.js.map
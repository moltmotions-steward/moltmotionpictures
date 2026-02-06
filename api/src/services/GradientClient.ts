/**
 * DigitalOcean Gradient AI Client
 * 
 * Typed client for the DO Serverless Inference API.
 * Handles LLM completions, image generation (FLUX.1), and video generation (Luma).
 * 
 * @see https://docs.digitalocean.com/products/gradient-ai/
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  GradientModel,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  GradientApiError,
  TTSRequest,
  TTSAsyncResponse,
  TTSResultResponse,
  AudioGenerationRequest,
  AudioGenerationResponse,
} from '../types/gradient';
import { GradientError } from '../types/gradient';

// =============================================================================
// Configuration
// =============================================================================

interface GradientClientConfig {
  apiKey: string;
  endpoint?: string;
  timeout?: number;
}

const DEFAULT_ENDPOINT = 'https://inference.do-ai.run';
const DEFAULT_TIMEOUT = 120000; // 2 minutes for video generation

// =============================================================================
// Client Class
// =============================================================================

export class GradientClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeout: number;

  constructor(config: GradientClientConfig) {
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

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
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
        const errorBody = await response.json().catch(() => ({})) as GradientApiError;
        throw new GradientError(
          errorBody.error?.message || `HTTP ${response.status}`,
          errorBody.error?.code || 'unknown_error',
          errorBody.error?.type || 'api_error',
          response.status
        );
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof GradientError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GradientError(
          'Request timed out',
          'timeout',
          'network_error',
          408
        );
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Models API
  // ---------------------------------------------------------------------------

  async listModels(): Promise<{ data: Array<{ id: string; object: string }> }> {
    return this.request('/v1/models', { method: 'GET' });
  }

  // ---------------------------------------------------------------------------
  // Chat Completions API (LLMs)
  // ---------------------------------------------------------------------------

  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    return this.request('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Convenience method for simple prompts
   */
  async prompt(
    message: string,
    options: {
      model?: GradientModel;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const messages: ChatMessage[] = [];

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

  private normalizeImageSize(width?: number, height?: number): 'auto' | '1536x1024' | '1024x1536' {
    if (!width || !height) return 'auto';
    if (width > height) return '1536x1024';
    if (height > width) return '1024x1536';
    return 'auto';
  }

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    // DigitalOcean image endpoint follows OpenAI-compatible schema and
    // currently returns base64 data in `data[].b64_json`.
    const payload: Record<string, unknown> = {
      model: request.model || 'openai-gpt-image-1',
      prompt: request.prompt,
      size: this.normalizeImageSize(request.width, request.height),
      n: Math.max(1, Math.min(1, request.num_images || 1)),
      quality: 'auto',
      output_format: 'png',
    };

    const response = await this.request<ImageGenerationResponse>('/v1/images/generations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Keep `images` stable for callers that may still read it.
    if (!response.images) {
      response.images = [];
    }

    return response;
  }

  /**
   * Generate a movie Scripter using FLUX.1
   */
  async generateScripter(
    prompt: string,
    options: {
      negativePrompt?: string;
      width?: number;
      height?: number;
      model?: 'flux.1-schnell' | 'flux.1-dev' | 'openai-gpt-image-1' | 'gpt-image-1';
    } = {}
  ): Promise<ImageGenerationResponse> {
    return this.generateImage({
      model: options.model || 'openai-gpt-image-1',
      prompt,
      negative_prompt: options.negativePrompt,
      width: options.width || 1024,
      height: options.height || 1536, // portrait orientation
    });
  }

  // ---------------------------------------------------------------------------
  // Video Generation API (Luma Dream Machine)
  // ---------------------------------------------------------------------------

  private normalizeLumaDurationSeconds(duration?: number): 5 | 10 {
    if (duration === 10) return 10;
    if (duration === 5) return 5;
    if (typeof duration !== 'number' || !Number.isFinite(duration)) return 5;
    return duration <= 5 ? 5 : 10;
  }

  async generateVideo(
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResponse> {
    const durationSeconds = this.normalizeLumaDurationSeconds(request.duration);
    // Luma Dream Machine endpoint
    return this.request('/v1/video/generations', {
      method: 'POST',
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
  async getVideoStatus(generationId: string): Promise<VideoGenerationResponse> {
    return this.request(`/v1/video/generations/${generationId}`, {
      method: 'GET',
    });
  }

  /**
   * Generate a shot with camera motion
   */
  async generateShot(
    prompt: string,
    options: {
      negativePrompt?: string;
      aspectRatio?: '16:9' | '9:16' | '1:1';
      duration?: number;
      cameraMotion?: string;
    } = {}
  ): Promise<VideoGenerationResponse> {
    return this.generateVideo({
      model: 'luma-dream-machine',
      prompt,
      negative_prompt: options.negativePrompt,
      aspect_ratio: options.aspectRatio || '16:9',
      duration: options.duration || 5,
      camera_motion: options.cameraMotion as VideoGenerationRequest['camera_motion'],
    });
  }

  // ---------------------------------------------------------------------------
  // TTS API (ElevenLabs via fal async-invoke)
  // ---------------------------------------------------------------------------

  /**
   * Generate speech from text using ElevenLabs TTS via DigitalOcean
   * Uses async-invoke pattern - starts job, returns request_id for polling
   */
  async generateTTS(
    request: TTSRequest
  ): Promise<TTSAsyncResponse> {
    return this.request('/v1/async-invoke', {
      method: 'POST',
      body: JSON.stringify({
        model_id: 'fal-ai/elevenlabs/tts/multilingual-v2',
        input: {
          text: request.text,
          voice_id: request.voice_id,
          model_id: request.model_id || 'eleven_multilingual_v2',
        },
        tags: [{ key: 'type', value: 'tts' }],
      }),
    });
  }

  /**
   * Check status of an async job (TTS or audio generation)
   */
  async getAsyncJobStatus(requestId: string): Promise<TTSAsyncResponse> {
    return this.request(`/v1/async-invoke/${requestId}/status`, {
      method: 'GET',
    });
  }

  /**
   * Get result of completed async job
   */
  async getAsyncJobResult(requestId: string): Promise<TTSResultResponse> {
    const raw = await this.request<any>(`/v1/async-invoke/${requestId}`, {
      method: 'GET',
    });

    // DO Gradient returns a generic async-invoke wrapper:
    // { status: 'COMPLETED', output: { audio: { url, content_type, ... } } }
    // Normalize to our internal { audio_url, content_type, duration_seconds? } shape.
    if (raw && typeof raw === 'object') {
      if (typeof raw.audio_url === 'string' && typeof raw.content_type === 'string') {
        return raw as TTSResultResponse;
      }

      const audio = raw.output?.audio;
      const audioUrl = audio?.url;
      const contentType = audio?.content_type;
      const durationSeconds = raw.output?.duration_seconds ?? raw.duration_seconds;

      if (typeof audioUrl === 'string' && typeof contentType === 'string') {
        return {
          audio_url: audioUrl,
          content_type: contentType,
          duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : undefined,
        };
      }
    }

    throw new GradientError(
      'Unexpected async job result shape',
      'unexpected_result_shape',
      'api_error',
      502
    );
  }

  /**
   * Generate TTS and wait for completion (convenience method)
   * Polls until complete or timeout
   */
  async generateTTSAndWait(
    text: string,
    options: {
      voiceId?: string;
      pollIntervalMs?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<TTSResultResponse> {
    const pollInterval = options.pollIntervalMs || 2000;
    const timeout = options.timeoutMs || 60000; // 1 minute default
    const startTime = Date.now();

    // Start the TTS job
    const job = await this.generateTTS({
      text,
      voice_id: options.voiceId,
    });

    // Poll until complete
    while (Date.now() - startTime < timeout) {
      const status = await this.getAsyncJobStatus(job.request_id);
      
      if (status.status === 'COMPLETE' || status.status === 'COMPLETED') {
        return this.getAsyncJobResult(job.request_id);
      }
      
      if (status.status === 'FAILED') {
        throw new GradientError(
          'TTS generation failed',
          'tts_failed',
          'generation_error',
          500
        );
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new GradientError(
      'TTS generation timed out',
      'timeout',
      'timeout_error',
      408
    );
  }

  // ---------------------------------------------------------------------------
  // Audio Generation API (Stable Audio via fal)
  // ---------------------------------------------------------------------------

  /**
   * Generate audio/music from text prompt
   */
  async generateAudio(
    request: AudioGenerationRequest
  ): Promise<TTSAsyncResponse> {
    return this.request('/v1/async-invoke', {
      method: 'POST',
      body: JSON.stringify({
        model_id: 'fal-ai/stable-audio-25/text-to-audio',
        input: {
          prompt: request.prompt,
          seconds_total: request.seconds_total || 30,
          seed: request.seed,
        },
        tags: [{ key: 'type', value: 'audio' }],
      }),
    });
  }

  // ---------------------------------------------------------------------------
  // Prompt Engineering Helpers
  // ---------------------------------------------------------------------------

  /**
   * Refine a rough prompt into a detailed video generation prompt
   */
  async refineVideoPrompt(roughPrompt: string): Promise<string> {
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
  async generateScripterPrompt(
    title: string,
    logline: string,
    genre: string
  ): Promise<string> {
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

// =============================================================================
// Singleton Export
// =============================================================================

let clientInstance: GradientClient | null = null;

export function getGradientClient(): GradientClient {
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

export default GradientClient;

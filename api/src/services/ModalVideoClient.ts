/**
 * Modal Video Generation Client
 * 
 * TypeScript client for calling the Modal-hosted LTX-2 video generation endpoint.
 * Uses Lightricks LTX-2 (19B) for synchronized audio-video generation.
 * 
 * Endpoint: https://rikc-speak--molt-ltx2-gen-ltx-2-generator-generate.modal.run
 */

// =============================================================================
// Types
// =============================================================================

export interface VideoGenerationRequest {
  prompt: string;
  audio_text?: string | null;      // Text for audio generation (LTX-2 feature)
  negative_prompt?: string;
  num_frames?: number;              // Default: 121 (~5s at 24fps)
  fps?: number;                     // Default: 24
  width?: number;                   // Default: 1280 (must be divisible by 32)
  height?: number;                  // Default: 704 (must be divisible by 32)
  num_inference_steps?: number;     // Default: 50
  guidance_scale?: number;          // Default: 7.5
  seed?: number | null;             // For reproducibility
}

export interface VideoGenerationResponse {
  video_base64: string;
  duration: number;                 // Video duration in seconds
  wall_clock_time: number;          // Generation time in seconds
  width: number;
  height: number;
  seed: number;
  model: string;                    // "LTX-2"
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

export class ModalVideoError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ModalVideoError';
  }
}

// =============================================================================
// Client Class
// =============================================================================

// LTX-2 endpoint (H100)
const LTX2_ENDPOINT = 'https://rikc-speak--molt-ltx2-gen-ltx-2-generator-generate.modal.run';
const LTX2_HEALTH_ENDPOINT = 'https://rikc-speak--molt-ltx2-gen-ltx-2-generator-health-check.modal.run';
const DEFAULT_TIMEOUT = 600000; // 10 minutes - video generation takes time

export class ModalVideoClient {
  private readonly endpoint: string;
  private readonly healthEndpoint: string;
  private readonly timeout: number;

  constructor(config: ModalVideoConfig = {}) {
    this.endpoint = config.endpoint || process.env.MODAL_VIDEO_ENDPOINT || LTX2_ENDPOINT;
    this.healthEndpoint = config.healthEndpoint || process.env.MODAL_HEALTH_ENDPOINT || LTX2_HEALTH_ENDPOINT;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<ModalHealthResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for health

    try {
      const response = await fetch(this.healthEndpoint, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ModalVideoError(
          `Health check failed: ${response.status}`,
          response.status
        );
      }

      return await response.json() as ModalHealthResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ModalVideoError) throw error;
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
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new ModalVideoError('Prompt is required', 400);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    console.log(`[ModalVideo/LTX-2] Generating video for prompt: ${request.prompt.slice(0, 100)}...`);
    const startTime = Date.now();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          audio_text: request.audio_text ?? null,
          negative_prompt: request.negative_prompt || 'low quality, worst quality, deformed, distorted',
          num_frames: request.num_frames || 121,
          fps: request.fps || 24,
          width: request.width || 1280,
          height: request.height || 704,  // Must be divisible by 32
          num_inference_steps: request.num_inference_steps || 50,
          guidance_scale: request.guidance_scale || 7.5,
          seed: request.seed ?? null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new ModalVideoError(
          (errorBody as { error?: string }).error || `HTTP ${response.status}`,
          response.status,
          errorBody
        );
      }

      const result = await response.json() as VideoGenerationResponse;
      const elapsedMs = Date.now() - startTime;
      
      console.log(`[ModalVideo/LTX-2] Video generated in ${(elapsedMs / 1000).toFixed(1)}s (modal: ${result.wall_clock_time?.toFixed(1)}s)`);
      console.log(`[ModalVideo/LTX-2]   Duration: ${result.duration}s, Resolution: ${result.width}x${result.height}, Model: ${result.model}`);

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ModalVideoError) throw error;
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
  async generateClip(
    prompt: string,
    options: {
      negativePrompt?: string;
      audioText?: string;
      seed?: number;
    } = {}
  ): Promise<VideoGenerationResponse> {
    return this.generateVideo({
      prompt,
      audio_text: options.audioText,
      negative_prompt: options.negativePrompt,
      num_frames: 49,  // ~2 seconds at 24fps (must be odd for LTX-2)
      num_inference_steps: 30,  // Faster but slightly lower quality
      seed: options.seed,
    });
  }

  /**
   * Generate a standard shot (~5 seconds).
   * Good for episode clips and voting variants.
   */
  async generateShot(
    prompt: string,
    options: {
      negativePrompt?: string;
      audioText?: string;
      aspectRatio?: '16:9' | '9:16' | '1:1';
      seed?: number;
    } = {}
  ): Promise<VideoGenerationResponse> {
    // Calculate dimensions based on aspect ratio (must be divisible by 32)
    let width = 1280;
    let height = 704;
    
    if (options.aspectRatio === '9:16') {
      width = 704;
      height = 1280;
    } else if (options.aspectRatio === '1:1') {
      width = 768;
      height = 768;
    }

    return this.generateVideo({
      prompt,
      audio_text: options.audioText,
      negative_prompt: options.negativePrompt,
      num_frames: 121,  // ~5 seconds
      width,
      height,
      seed: options.seed,
    });
  }

  /**
   * Generate a longer sequence (~8 seconds).
   * Higher quality settings, takes longer.
   */
  async generateSequence(
    prompt: string,
    options: {
      negativePrompt?: string;
      audioText?: string;
      seed?: number;
    } = {}
  ): Promise<VideoGenerationResponse> {
    return this.generateVideo({
      prompt,
      audio_text: options.audioText,
      negative_prompt: options.negativePrompt,
      num_frames: 193,  // ~8 seconds at 24fps (must be odd for LTX-2)
      num_inference_steps: 50,
      guidance_scale: 7.5,
      seed: options.seed,
    });
  }

  /**
   * Generate a video with synchronized audio narration.
   * Uses LTX-2's native audio-video sync capabilities.
   */
  async generateWithAudio(
    prompt: string,
    audioText: string,
    options: {
      negativePrompt?: string;
      numFrames?: number;
      seed?: number;
    } = {}
  ): Promise<VideoGenerationResponse> {
    return this.generateVideo({
      prompt,
      audio_text: audioText,
      negative_prompt: options.negativePrompt,
      num_frames: options.numFrames || 121,
      seed: options.seed,
    });
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let clientInstance: ModalVideoClient | null = null;

export function getModalVideoClient(): ModalVideoClient {
  if (!clientInstance) {
    clientInstance = new ModalVideoClient();
  }
  return clientInstance;
}

export default ModalVideoClient;

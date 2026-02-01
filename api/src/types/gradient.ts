/**
 * DigitalOcean Gradient AI Platform Types
 * 
 * Type definitions for the DO Serverless Inference API
 * Endpoint: https://inference.do-ai.run
 * 
 * @see https://docs.digitalocean.com/products/gradient-ai/
 */

// =============================================================================
// Request Types
// =============================================================================

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
  temperature?: number;       // 0.0 - 1.0
  max_tokens?: number;        // Limit output tokens
  top_p?: number;             // Nucleus sampling
  frequency_penalty?: number; // -2.0 to 2.0
  presence_penalty?: number;  // -2.0 to 2.0
  stop?: string | string[];   // Stop sequences
  stream?: boolean;           // Enable streaming
  n?: number;                 // Number of completions
}

// =============================================================================
// Response Types
// =============================================================================

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

// =============================================================================
// Available Models
// =============================================================================

export type GradientModel =
  // LLMs
  | 'llama3.3-70b-instruct'
  | 'llama3.1-8b-instruct'
  | 'llama3.1-70b-instruct'
  | 'llama3.1-405b-instruct'
  | 'mistral-nemo-instruct-2407'
  | 'qwen2.5-coder-32b-instruct'
  // Image Generation
  | 'flux.1-schnell'
  | 'flux.1-dev'
  // Vision
  | 'llama3.2-90b-vision-instruct'
  // Video (Luma Dream Machine)
  | 'luma-dream-machine';

// =============================================================================
// Model Metadata
// =============================================================================

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

export const GRADIENT_MODELS: Record<GradientModel, ModelInfo> = {
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
};

// =============================================================================
// Image Generation Types (FLUX.1)
// =============================================================================

export interface ImageGenerationRequest {
  model: 'flux.1-schnell' | 'flux.1-dev';
  prompt: string;
  negative_prompt?: string;
  width?: number;    // 512-2048, default 1024
  height?: number;   // 512-2048, default 1024
  steps?: number;    // 1-50, default 4 for schnell, 20 for dev
  guidance?: number; // 1-20, default 3.5
  seed?: number;     // For reproducibility
  num_images?: number; // 1-4
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

// =============================================================================
// Video Generation Types (Luma Dream Machine)
// =============================================================================

export interface VideoGenerationRequest {
  model: 'luma-dream-machine';
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  duration?: number;      // seconds
  loop?: boolean;
  keyframes?: VideoKeyframe[];
  camera_motion?: CameraMotion;
}

export interface VideoKeyframe {
  type: 'image' | 'generation';
  url?: string;           // For image type
  prompt?: string;        // For generation type
  frame?: 'first' | 'last';
}

export type CameraMotion =
  | 'static'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'zoom_in'
  | 'zoom_out'
  | 'orbit_left'
  | 'orbit_right'
  | 'crane_up'
  | 'crane_down';

export interface VideoGenerationResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

// =============================================================================
// API Error Types
// =============================================================================

export interface GradientApiError {
  error: {
    message: string;
    type: string;
    code: string;
    param?: string;
  };
}

export class GradientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly type: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'GradientError';
  }
}

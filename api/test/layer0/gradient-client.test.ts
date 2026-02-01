/**
 * Layer 0 Unit Tests for GradientClient
 * 
 * Tests the GradientClient class logic without making real API calls.
 * Uses mocked fetch to verify request/response handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GradientClient } from '../../src/services/GradientClient';
import { GradientError } from '../../src/types/gradient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GradientClient', () => {
  let client: GradientClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GradientClient({
      apiKey: 'test-api-key',
      endpoint: 'https://inference.do-ai.run',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new GradientClient({ apiKey: '' })).toThrow('GradientClient requires an API key');
    });

    it('should use default endpoint if not provided', () => {
      const defaultClient = new GradientClient({ apiKey: 'test' });
      // The endpoint is private, but we can verify by checking a request
      expect(defaultClient).toBeDefined();
    });
  });

  describe('listModels', () => {
    it('should call /v1/models endpoint', async () => {
      const mockResponse = {
        data: [
          { id: 'llama3.3-70b-instruct', object: 'model' },
          { id: 'flux.1-schnell', object: 'model' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inference.do-ai.run/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.data).toHaveLength(2);
    });
  });

  describe('chatCompletion', () => {
    it('should send correct request to /v1/chat/completions', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama3.3-70b-instruct',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!', refusal: null, audio: null },
          finish_reason: 'stop',
          logprobs: null,
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        service_tier: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.chatCompletion({
        model: 'llama3.3-70b-instruct',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inference.do-ai.run/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'llama3.3-70b-instruct',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7,
            max_tokens: 100,
          }),
        })
      );
      expect(result.choices[0].message.content).toBe('Hello!');
    });

    it('should handle API errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded',
          },
        }),
      });

      await expect(
        client.chatCompletion({
          model: 'llama3.3-70b-instruct',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('prompt', () => {
    it('should be a convenience method for simple prompts', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama3.3-70b-instruct',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Paris is the capital of France.', refusal: null, audio: null },
          finish_reason: 'stop',
          logprobs: null,
        }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        service_tier: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.prompt('What is the capital of France?');

      expect(result).toBe('Paris is the capital of France.');
    });

    it('should include system prompt when provided', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama3.3-70b-instruct',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Response', refusal: null, audio: null },
          finish_reason: 'stop',
          logprobs: null,
        }],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
        service_tier: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.prompt('Hello', { systemPrompt: 'You are a helpful assistant' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages).toHaveLength(2);
      expect(callBody.messages[0].role).toBe('system');
      expect(callBody.messages[0].content).toBe('You are a helpful assistant');
    });
  });

  describe('generateImage', () => {
    it('should call /v1/images/generations endpoint', async () => {
      const mockResponse = {
        images: [{
          url: 'https://example.com/image.png',
          content_type: 'image/png',
          width: 1024,
          height: 1024,
          seed: 12345,
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.generateImage({
        model: 'flux.1-schnell',
        prompt: 'A beautiful sunset',
        width: 1024,
        height: 1024,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inference.do-ai.run/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe('https://example.com/image.png');
    });
  });

  describe('generatePoster', () => {
    it('should use poster dimensions by default', async () => {
      const mockResponse = {
        images: [{
          url: 'https://example.com/poster.png',
          content_type: 'image/png',
          width: 2048,
          height: 3072,
          seed: 12345,
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.generatePoster('A movie poster');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.size).toBe('2048x3072'); // 2:3 aspect ratio
    });
  });

  describe('generateVideo', () => {
    it('should call /v1/video/generations endpoint', async () => {
      const mockResponse = {
        id: 'gen-123',
        status: 'pending',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.generateVideo({
        model: 'luma-dream-machine',
        prompt: 'A cinematic shot of a sunset',
        aspect_ratio: '16:9',
        duration: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inference.do-ai.run/v1/video/generations',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.id).toBe('gen-123');
      expect(result.status).toBe('pending');
    });
  });

  describe('getVideoStatus', () => {
    it('should check generation status', async () => {
      const mockResponse = {
        id: 'gen-123',
        status: 'completed',
        video_url: 'https://example.com/video.mp4',
        thumbnail_url: 'https://example.com/thumb.jpg',
        duration: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getVideoStatus('gen-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inference.do-ai.run/v1/video/generations/gen-123',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result.status).toBe('completed');
      expect(result.video_url).toBe('https://example.com/video.mp4');
    });
  });

  describe('refineVideoPrompt', () => {
    it('should use cinematographer system prompt', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama3.3-70b-instruct',
        choices: [{
          index: 0,
          message: { 
            role: 'assistant', 
            content: 'A slow dolly shot reveals a vast desert landscape at golden hour, dust particles floating in the warm light, the camera pushing forward through heat distortion waves.',
            refusal: null, 
            audio: null 
          },
          finish_reason: 'stop',
          logprobs: null,
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        service_tier: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.refineVideoPrompt('A desert scene');

      expect(result).toContain('dolly shot');
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].role).toBe('system');
      expect(callBody.messages[0].content).toContain('cinematographer');
    });
  });

  describe('generatePosterPrompt', () => {
    it('should create prompt from movie details', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama3.3-70b-instruct',
        choices: [{
          index: 0,
          message: { 
            role: 'assistant', 
            content: 'A dramatic noir-style poster featuring a silhouetted figure against a rain-soaked city skyline, neon lights reflecting in puddles, high contrast black and white with splashes of red.',
            refusal: null, 
            audio: null 
          },
          finish_reason: 'stop',
          logprobs: null,
        }],
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
        service_tier: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.generatePosterPrompt(
        'Midnight Shadows',
        'A detective hunts a serial killer in a rain-soaked city',
        'noir'
      );

      expect(result).toContain('noir');
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].role).toBe('system');
      expect(callBody.messages[0].content).toContain('poster designer');
    });
  });

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      // Mock AbortController signal abort
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Request timed out');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(
        client.listModels()
      ).rejects.toThrow('Request timed out');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.listModels()
      ).rejects.toThrow('Network error');
    });

    it('should parse API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid model specified',
            type: 'invalid_request_error',
            code: 'invalid_model',
          },
        }),
      });

      try {
        await client.chatCompletion({
          model: 'invalid-model' as any,
          messages: [{ role: 'user', content: 'Hello' }],
        });
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.name).toBe('GradientError');
        expect(error.code).toBe('invalid_model');
        expect(error.statusCode).toBe(400);
      }
    });
  });
});

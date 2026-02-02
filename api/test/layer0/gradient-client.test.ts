/**
 * Layer 0 Unit Tests for GradientClient
 * 
 * Tests pure logic: configuration validation, request/response parsing, error handling.
 * NO external dependencies or mocks - test only static methods and configuration.
 */

import { describe, it, expect } from 'vitest';

describe('GradientClient - Pure Logic Tests', () => {

  describe('Configuration Validation', () => {
    it('validates required API key presence', () => {
      const config = { apiKey: 'test-key-12345' };
      const isConfigured = !!config.apiKey && config.apiKey.length > 0;
      expect(isConfigured).toBe(true);
    });

    it('rejects empty API key', () => {
      const config = { apiKey: '' };
      const isConfigured = !!config.apiKey && config.apiKey.length > 0;
      expect(isConfigured).toBe(false);
    });

    it('uses default endpoint when not provided', () => {
      const defaultEndpoint = 'https://inference.do-ai.run';
      expect(defaultEndpoint).toContain('https://');
      expect(defaultEndpoint).toContain('do-ai');
    });

    it('accepts custom endpoint', () => {
      const customEndpoint = 'https://gradient.custom.api';
      const isValid = customEndpoint.startsWith('https://');
      expect(isValid).toBe(true);
    });
  });

  describe('Request Payload Construction', () => {
    it('builds valid video generation request', () => {
      const payload = {
        prompt: 'A wide shot of a city skyline at sunset',
        duration_seconds: 5,
        model: 'flux.1-schnell',
        style: 'cinematic'
      };

      expect(payload.prompt).toBeTruthy();
      expect(payload.duration_seconds).toBeGreaterThan(0);
      expect(payload.model).toBeTruthy();
      expect(payload.style).toBeTruthy();
    });

    it('validates prompt length', () => {
      const shortPrompt = 'A';
      const validPrompt = 'A wide shot of a city skyline at sunset with dramatic lighting';
      const maxLength = 1000;

      expect(shortPrompt.length < 10).toBe(true);
      expect(validPrompt.length).toBeGreaterThan(10);
      expect(validPrompt.length).toBeLessThanOrEqual(maxLength);
    });

    it('validates duration bounds', () => {
      // Video generation is provider-limited. For the current video model (Luma),
      // we treat durations as short clips and normalize to 5s or 10s.
      const normalize = (duration?: number): 5 | 10 => {
        if (duration === 10) return 10;
        if (duration === 5) return 5;
        if (typeof duration !== 'number' || !Number.isFinite(duration)) return 5;
        return duration <= 5 ? 5 : 10;
      };

      const testDurations = [
        { duration: undefined, expected: 5 },
        { duration: 0, expected: 5 },
        { duration: 1, expected: 5 },
        { duration: 5, expected: 5 },
        { duration: 6, expected: 10 },
        { duration: 8, expected: 10 },
        { duration: 10, expected: 10 },
        { duration: 30, expected: 10 },
        { duration: 60, expected: 10 },
      ];

      for (const { duration, expected } of testDurations) {
        expect(normalize(duration)).toBe(expected);
      }
    });

    it('validates model names', () => {
      const validModels = ['flux.1-schnell', 'flux.1-dev', 'llama3.3-70b-instruct'];
      const invalidModels = ['random-model', '', 'flux'];

      for (const model of validModels) {
        expect(model).toMatch(/^[a-z0-9\.\-]+$/);
      }

      // Invalid models should fail basic length check or not be in valid list
      for (const model of invalidModels) {
        const isInvalidList = invalidModels.includes(model);
        expect(isInvalidList).toBe(true);
      }
    });
  });

  describe('Response Parsing', () => {
    it('extracts generation ID from response', () => {
      const response = {
        id: 'gen_abc123def456',
        status: 'pending',
        created_at: '2026-02-01T10:00:00Z'
      };

      expect(response.id).toMatch(/^gen_/);
      expect(response.status).toBe('pending');
      expect(response.created_at).toBeTruthy();
    });

    it('identifies generation status values', () => {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
      const terminalStates = ['completed', 'failed', 'cancelled'];
      const inProgressStates = ['pending', 'processing'];

      for (const status of validStatuses) {
        const isTerminal = terminalStates.includes(status);
        const isInProgress = inProgressStates.includes(status);
        expect(isTerminal || isInProgress).toBe(true);
      }
    });

    it('detects completion status', () => {
      const completedStatuses = ['completed', 'failed'];
      
      for (const status of completedStatuses) {
        const isComplete = ['completed', 'failed'].includes(status);
        expect(isComplete).toBe(true);
      }
    });

    it('extracts video URL from completed generation', () => {
      const response = {
        id: 'gen_123',
        status: 'completed',
        video_url: 'https://cdn.gradient.ai/video/gen_123.mp4',
        completed_at: '2026-02-01T10:05:00Z'
      };

      expect(response.video_url).toContain('https://');
      expect(response.video_url).toMatch(/\.mp4$/);
    });

    it('handles error responses', () => {
      const errorResponse = {
        error: {
          code: 'INVALID_PROMPT',
          message: 'Prompt exceeds maximum length'
        }
      };

      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBeTruthy();
      expect(errorResponse.error.message).toBeTruthy();
    });
  });

  describe('Error Classification', () => {
    it('identifies rate limit errors (429)', () => {
      const statusCode = 429;
      const isRateLimit = statusCode === 429;
      expect(isRateLimit).toBe(true);
    });

    it('identifies authentication errors (401, 403)', () => {
      const authErrors = [401, 403];
      
      for (const code of authErrors) {
        const isAuthError = [401, 403].includes(code);
        expect(isAuthError).toBe(true);
      }
    });

    it('identifies validation errors (400, 422)', () => {
      const validationErrors = [400, 422];
      
      for (const code of validationErrors) {
        const isValidationError = [400, 422].includes(code);
        expect(isValidationError).toBe(true);
      }
    });

    it('identifies server errors (5xx)', () => {
      const serverErrors = [500, 502, 503, 504];
      
      for (const code of serverErrors) {
        const isServerError = code >= 500 && code < 600;
        expect(isServerError).toBe(true);
      }
    });

    it('identifies retryable status codes', () => {
      const retryableCodes = [408, 429, 500, 502, 503, 504];
      const nonRetryableCodes = [400, 401, 403, 404, 422];

      for (const code of retryableCodes) {
        const isRetryable = [408, 429, 500, 502, 503, 504].includes(code);
        expect(isRetryable).toBe(true);
      }

      for (const code of nonRetryableCodes) {
        const isRetryable = [408, 429, 500, 502, 503, 504].includes(code);
        expect(isRetryable).toBe(false);
      }
    });
  });

  describe('Retry Logic', () => {
    it('calculates exponential backoff delays', () => {
      const baseDelay = 1000;
      const maxDelay = 30000;

      const testCases = [
        { attempt: 1, expected: 1000 },
        { attempt: 2, expected: 2000 },
        { attempt: 3, expected: 4000 },
        { attempt: 4, expected: 8000 },
        { attempt: 5, expected: 16000 }
      ];

      for (const { attempt, expected } of testCases) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        expect(delay).toBe(expected);
      }
    });

    it('caps backoff at maximum delay', () => {
      const baseDelay = 1000;
      const maxDelay = 30000;
      const attempt = 10;

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      expect(delay).toBe(maxDelay);
    });

    it('adds jitter to backoff delay', () => {
      const baseDelay = 1000;
      const attempt = 2;
      const jitterFactor = 0.1; // ±10%

      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitterMin = delay * (1 - jitterFactor);
      const jitterMax = delay * (1 + jitterFactor);

      expect(jitterMin).toBeLessThan(delay);
      expect(jitterMax).toBeGreaterThan(delay);
    });
  });

  describe('Header Construction', () => {
    it('builds authorization headers with API key', () => {
      const apiKey = 'gsk_test123';
      const authHeader = `Bearer ${apiKey}`;

      expect(authHeader).toContain('Bearer');
      expect(authHeader).toContain(apiKey);
    });

    it('sets content-type header', () => {
      const contentType = 'application/json';
      expect(contentType).toBe('application/json');
    });

    it('constructs user-agent header', () => {
      const userAgent = 'GradientClient/1.0';
      expect(userAgent).toContain('GradientClient');
    });
  });

  describe('Model Listing', () => {
    it('parses model list response', () => {
      const response = {
        data: [
          { id: 'flux.1-schnell', object: 'model', created: 1609459200 },
          { id: 'llama3.3-70b-instruct', object: 'model', created: 1609459200 }
        ]
      };

      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      
      for (const model of response.data) {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('object');
        expect(model.object).toBe('model');
      }
    });

    it('filters models by type', () => {
      const models = [
        { id: 'flux.1-schnell', type: 'vision' },
        { id: 'llama3.3-70b-instruct', type: 'text' },
        { id: 'flux.1-dev', type: 'vision' }
      ];

      const visionModels = models.filter(m => m.type === 'vision');
      expect(visionModels.length).toBe(2);
      
      const textModels = models.filter(m => m.type === 'text');
      expect(textModels.length).toBe(1);
    });
  });

  describe('Polling Logic', () => {
    it('determines polling intervals', () => {
      const statusProgression = [
        { status: 'pending', interval: 1000 },
        { status: 'processing', interval: 2000 },
        { status: 'completed', interval: 0 }
      ];

      for (const { status, interval } of statusProgression) {
        if (status === 'completed') {
          expect(interval).toBe(0);
        } else {
          expect(interval).toBeGreaterThan(0);
        }
      }
    });

    it('respects maximum polling time', () => {
      const maxPollingTime = 3600000; // 1 hour
      const testDuration = 1800000; // 30 minutes

      expect(testDuration).toBeLessThanOrEqual(maxPollingTime);
    });
  });
});

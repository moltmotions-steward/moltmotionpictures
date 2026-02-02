/**
 * Layer 0 Unit Tests for Production Types
 * 
 * Tests type validation and helper functions without any external dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  GRADIENT_MODELS,
  GradientError,
} from '../../src/types/gradient';
import { getSpacesCdnUrl } from '../../src/types/spaces';

describe('Gradient Types', () => {
  describe('GRADIENT_MODELS', () => {
    it('should have all LLM models defined', () => {
      expect(GRADIENT_MODELS['llama3.3-70b-instruct']).toBeDefined();
      expect(GRADIENT_MODELS['llama3.3-70b-instruct'].type).toBe('llm');
      expect(GRADIENT_MODELS['llama3.3-70b-instruct'].contextWindow).toBe(128000);
    });

    it('should have image generation models defined', () => {
      expect(GRADIENT_MODELS['flux.1-schnell']).toBeDefined();
      expect(GRADIENT_MODELS['flux.1-schnell'].type).toBe('image');
      expect(GRADIENT_MODELS['flux.1-dev']).toBeDefined();
      expect(GRADIENT_MODELS['flux.1-dev'].type).toBe('image');
    });

    it('should have video generation model defined', () => {
      expect(GRADIENT_MODELS['luma-dream-machine']).toBeDefined();
      expect(GRADIENT_MODELS['luma-dream-machine'].type).toBe('video');
    });

    it('should have vision model defined', () => {
      expect(GRADIENT_MODELS['llama3.2-90b-vision-instruct']).toBeDefined();
      expect(GRADIENT_MODELS['llama3.2-90b-vision-instruct'].type).toBe('vision');
    });

    it('should have all required model properties', () => {
      for (const [id, model] of Object.entries(GRADIENT_MODELS)) {
        expect(model.id).toBe(id);
        expect(model.name).toBeTruthy();
        expect(['llm', 'image', 'video', 'vision']).toContain(model.type);
      }
    });
  });

  describe('GradientError', () => {
    it('should create error with all properties', () => {
      const error = new GradientError(
        'Rate limit exceeded',
        'rate_limit_error',
        'api_error',
        429
      );

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('rate_limit_error');
      expect(error.type).toBe('api_error');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('GradientError');
    });

    it('should be instanceof Error', () => {
      const error = new GradientError('Test', 'test', 'test', 500);
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('Spaces Types', () => {
  describe('getSpacesCdnUrl', () => {
    it('should generate correct CDN URL', () => {
      const config = {
        key: 'test-key',
        secret: 'test-secret',
        bucket: 'molt-studios-assets',
        region: 'nyc3',
        endpoint: 'https://nyc3.digitaloceanspaces.com',
      };

      const url = getSpacesCdnUrl(config, 'productions/123/Scripter.png');
      expect(url).toBe('https://molt-studios-assets.nyc3.cdn.digitaloceanspaces.com/productions/123/Scripter.png');
    });

    it('should handle different regions', () => {
      const config = {
        key: 'test-key',
        secret: 'test-secret',
        bucket: 'my-bucket',
        region: 'sfo3',
        endpoint: 'https://sfo3.digitaloceanspaces.com',
      };

      const url = getSpacesCdnUrl(config, 'test/file.mp4');
      expect(url).toBe('https://my-bucket.sfo3.cdn.digitaloceanspaces.com/test/file.mp4');
    });

    it('should handle special characters in key', () => {
      const config = {
        key: 'test-key',
        secret: 'test-secret',
        bucket: 'assets',
        region: 'ams3',
        endpoint: 'https://ams3.digitaloceanspaces.com',
      };

      const url = getSpacesCdnUrl(config, 'path/to/file with spaces.png');
      expect(url).toBe('https://assets.ams3.cdn.digitaloceanspaces.com/path/to/file with spaces.png');
    });
  });
});

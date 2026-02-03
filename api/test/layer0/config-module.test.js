/**
 * Layer 0 - Config Module Execution Tests
 * Tests that import and execute config module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Layer 0 - Config Module Execution', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clear module cache to reload config
    delete require.cache[require.resolve('../../src/config/index.ts')];
  });

  describe('Config loading', () => {
    it('loads config module successfully', async () => {
      const config = await import('../../src/config/index.ts?t=' + Date.now());
      
      expect(config).toBeDefined();
      expect(config.default).toBeDefined();
    });

    it('exports port configuration', async () => {
      const config = await import('../../src/config/index.ts?t=' + Date.now());
      
      expect(config.default.port).toBeDefined();
      expect(typeof config.default.port).toBe('number');
    });

    it('exports environment', async () => {
      const config = await import('../../src/config/index.ts?t=' + Date.now());
      
      expect(config.default.nodeEnv).toBeDefined();
      expect(typeof config.default.nodeEnv).toBe('string');
    });

    it('exports database configuration', async () => {
      const config = await import('../../src/config/index.ts?t=' + Date.now());
      
      expect(config.default.database).toBeDefined();
    });

    it('exports rate limit configuration', async () => {
      const config = await import('../../src/config/index.ts?t=' + Date.now());
      
      expect(config.default.rateLimits).toBeDefined();
    });

    it('exports moltmotionpictures configuration', async () => {
      const config = await import('../../src/config/index.ts?t=' + Date.now());
      
      expect(config.default.moltmotionpictures).toBeDefined();
      expect(config.default.moltmotionpictures.tokenPrefix).toBeDefined();
      expect(config.default.moltmotionpictures.claimPrefix).toBeDefined();
    });
  });

  describe('Environment-specific configuration', () => {
    it('has environment set', async () => {
      const config = await import('../../src/config/index.ts?dev=' + Date.now());
      
      expect(config.default.nodeEnv).toBeDefined();
      expect(typeof config.default.nodeEnv).toBe('string');
    });

    it('configures different port from environment', async () => {
      process.env.PORT = '5000';
      const config = await import('../../src/config/index.ts?port=' + Date.now());
      
      expect(config.default.port).toBe(5000);
    });
  });

  describe('Rate limit configuration', () => {
    it('has rate limits configuration', async () => {
      const config = await import('../../src/config/index.ts?rl=' + Date.now());
      
      expect(config.default.rateLimits).toBeDefined();
      expect(config.default.rateLimits.requests).toBeDefined();
      expect(config.default.rateLimits.Scripts).toBeDefined();
      expect(config.default.rateLimits.comments).toBeDefined();
    });
  });

  describe('Token prefixes', () => {
    it('has correct API key prefix', async () => {
      const config = await import('../../src/config/index.ts?api=' + Date.now());
      
      expect(config.default.moltmotionpictures.tokenPrefix).toBe('moltmotionpictures_');
    });

    it('has correct claim token prefix', async () => {
      const config = await import('../../src/config/index.ts?claim=' + Date.now());
      
      expect(config.default.moltmotionpictures.claimPrefix).toBe('moltmotionpictures_claim_');
    });
  });
});

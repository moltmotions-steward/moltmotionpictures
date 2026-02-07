import { describe, it, expect } from 'vitest';
import { AUTO_RETRY_CONFIG } from '../../src/services/AudioSeriesProductionService';

describe('AudioSeriesProductionService - Auto-Retry Configuration', () => {
  describe('backoff calculation', () => {
    it('calculates exponential backoff correctly', () => {
      const base = AUTO_RETRY_CONFIG.retryDelayHours;
      const mult = AUTO_RETRY_CONFIG.backoffMultiplier;

      expect(base * Math.pow(mult, 0)).toBe(24); // 0 retries = 24h
      expect(base * Math.pow(mult, 1)).toBe(36); // 1 retry = 36h
      expect(base * Math.pow(mult, 2)).toBe(54); // 2 retries = 54h
      expect(base * Math.pow(mult, 3)).toBe(81); // 3 retries = 81h
      expect(base * Math.pow(mult, 4)).toBe(121.5); // 4 retries = 121.5h
    });

    it('respects max retry limit', () => {
      expect(AUTO_RETRY_CONFIG.maxAutoRetries).toBeGreaterThan(0);
      expect(AUTO_RETRY_CONFIG.maxAutoRetries).toBeLessThanOrEqual(10);
    });

    it('has reasonable default values', () => {
      expect(AUTO_RETRY_CONFIG.enabled).toBe(true);
      expect(AUTO_RETRY_CONFIG.retryDelayHours).toBeGreaterThanOrEqual(1);
      expect(AUTO_RETRY_CONFIG.backoffMultiplier).toBeGreaterThan(1);
      expect(AUTO_RETRY_CONFIG.maxAgeDays).toBeGreaterThan(0);
      expect(AUTO_RETRY_CONFIG.maxEpisodesPerTick).toBeGreaterThan(0);
    });
  });

  describe('age filtering', () => {
    it('correctly calculates max age cutoff', () => {
      const maxAgeMs = AUTO_RETRY_CONFIG.maxAgeDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const oldEpisode = new Date(now - maxAgeMs - 1000);
      const youngEpisode = new Date(now - maxAgeMs + 1000);

      expect(now - oldEpisode.getTime()).toBeGreaterThan(maxAgeMs);
      expect(now - youngEpisode.getTime()).toBeLessThan(maxAgeMs);
    });

    it('max age is at least 7 days', () => {
      expect(AUTO_RETRY_CONFIG.maxAgeDays).toBeGreaterThanOrEqual(7);
    });
  });

  describe('backoff timing', () => {
    it('first retry happens after 24 hours', () => {
      const firstRetryDelayHours = AUTO_RETRY_CONFIG.retryDelayHours * Math.pow(AUTO_RETRY_CONFIG.backoffMultiplier, 0);
      expect(firstRetryDelayHours).toBe(24);
    });

    it('backoff delays increase exponentially', () => {
      const delays = [];
      for (let i = 0; i < AUTO_RETRY_CONFIG.maxAutoRetries; i++) {
        const delay = AUTO_RETRY_CONFIG.retryDelayHours * Math.pow(AUTO_RETRY_CONFIG.backoffMultiplier, i);
        delays.push(delay);
      }

      // Each delay should be larger than the previous
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1]);
      }
    });

    it('final retry delay is less than max age', () => {
      const finalRetryDelay = AUTO_RETRY_CONFIG.retryDelayHours * Math.pow(AUTO_RETRY_CONFIG.backoffMultiplier, AUTO_RETRY_CONFIG.maxAutoRetries - 1);
      const maxAgeHours = AUTO_RETRY_CONFIG.maxAgeDays * 24;

      expect(finalRetryDelay).toBeLessThan(maxAgeHours);
    });
  });

  describe('rate limiting', () => {
    it('limits episodes per tick to reasonable number', () => {
      expect(AUTO_RETRY_CONFIG.maxEpisodesPerTick).toBeGreaterThanOrEqual(5);
      expect(AUTO_RETRY_CONFIG.maxEpisodesPerTick).toBeLessThanOrEqual(50);
    });
  });
});

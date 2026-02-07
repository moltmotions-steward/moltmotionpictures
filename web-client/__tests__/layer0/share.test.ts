import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildShareUrl, canUseNativeShare, formatShareText } from '@/lib/share';

/**
 * Layer 0: Pure Logic Unit Tests for Share Utility
 *
 * These tests exercise pure functions with no external IO:
 * - URL construction
 * - Text formatting
 * - Feature detection
 *
 * Run with: npm run test:layer0 -- share.test.ts
 */

describe('Share Utility Functions - Layer 0', () => {
  describe('buildShareUrl', () => {
    it('should construct full URL from script ID with default base', () => {
      const url = buildShareUrl('abc123', 'https://www.moltmotionpictures.com');
      expect(url).toBe('https://www.moltmotionpictures.com/post/abc123');
    });

    it('should construct full URL with custom base URL', () => {
      const url = buildShareUrl('xyz789', 'http://localhost:3001');
      expect(url).toBe('http://localhost:3001/post/xyz789');
    });

    it('should handle different script ID formats', () => {
      expect(buildShareUrl('short', 'https://test.com')).toBe('https://test.com/post/short');
      expect(buildShareUrl('very-long-id-12345678', 'https://test.com')).toBe('https://test.com/post/very-long-id-12345678');
      expect(buildShareUrl('with_underscore', 'https://test.com')).toBe('https://test.com/post/with_underscore');
    });

    it('should preserve base URL protocol', () => {
      expect(buildShareUrl('test', 'http://insecure.com')).toContain('http://');
      expect(buildShareUrl('test', 'https://secure.com')).toContain('https://');
    });
  });

  describe('canUseNativeShare', () => {
    it('should return boolean value', () => {
      const result = canUseNativeShare();
      expect(typeof result).toBe('boolean');
    });

    it('should detect Web Share API availability', () => {
      // In test environment, navigator.share may not be available
      // This test validates the function returns a boolean
      const hasShare = canUseNativeShare();
      expect(hasShare).toBe(false); // JSDOM doesn't have navigator.share
    });
  });

  describe('formatShareText', () => {
    it('should format share text correctly with title and author', () => {
      const script = { title: 'Test Script', authorName: 'TestAgent' };
      const text = formatShareText(script);
      expect(text).toBe('Test Script by TestAgent');
    });

    it('should handle short titles', () => {
      const script = { title: 'Hi', authorName: 'Bot' };
      const text = formatShareText(script);
      expect(text).toBe('Hi by Bot');
      expect(text.length).toBeLessThan(280);
    });

    it('should truncate very long titles', () => {
      const longTitle = 'A'.repeat(300);
      const script = { title: longTitle, authorName: 'Agent' };
      const text = formatShareText(script);

      // Should be truncated to stay under 250 characters (Twitter-safe)
      expect(text.length).toBeLessThan(280);
      expect(text).toContain('...');
      expect(text).toContain('by Agent');
    });

    it('should preserve full title when under limit', () => {
      const title = 'This is a reasonable length title for a script';
      const script = { title, authorName: 'TestUser' };
      const text = formatShareText(script);

      expect(text).toBe(`${title} by TestUser`);
      expect(text).not.toContain('...');
    });

    it('should handle special characters in title', () => {
      const script = { title: 'Title with "quotes" & symbols!', authorName: 'Agent123' };
      const text = formatShareText(script);
      expect(text).toBe('Title with "quotes" & symbols! by Agent123');
    });

    it('should handle special characters in author name', () => {
      const script = { title: 'Normal Title', authorName: 'Agent_123' };
      const text = formatShareText(script);
      expect(text).toBe('Normal Title by Agent_123');
    });

    it('should maintain format with edge case lengths', () => {
      // Test at exactly the boundary
      const maxTitleLength = 250 - ' by Agent'.length;
      const title = 'X'.repeat(maxTitleLength);
      const script = { title, authorName: 'Agent' };
      const text = formatShareText(script);

      expect(text.length).toBeLessThanOrEqual(280);
      expect(text).toContain('by Agent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings gracefully', () => {
      const script = { title: '', authorName: '' };
      const text = formatShareText(script);
      expect(text).toBe(' by ');
    });

    it('should handle unicode characters', () => {
      const script = { title: 'Script 🎬', authorName: 'Agent 🤖' };
      const text = formatShareText(script);
      expect(text).toBe('Script 🎬 by Agent 🤖');
    });

    it('should handle newlines in title', () => {
      const script = { title: 'Multi\nLine\nTitle', authorName: 'Agent' };
      const text = formatShareText(script);
      expect(text).toContain('\n');
      expect(text).toContain('by Agent');
    });
  });
});

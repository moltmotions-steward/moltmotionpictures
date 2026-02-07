import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shareScript, buildSocialShareUrls } from '@/lib/share';
import type { Script } from '@/types';

/**
 * Layer 1: Integration Tests for Share Functionality
 *
 * These tests exercise integration with mocked browser APIs:
 * - Clipboard API
 * - Web Share API
 * - PostHog analytics
 * - Toast notifications
 *
 * Run with: npm run test:layer1 -- share-integration.test.ts
 */

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn()
  }
}));

vi.mock('@/lib/utils', () => ({
  copyToClipboard: vi.fn(),
  getScriptUrl: vi.fn((id: string) => `/post/${id}`)
}));

import { toast } from 'sonner';
import posthog from 'posthog-js';
import { copyToClipboard } from '@/lib/utils';

describe('Share Integration - Layer 1', () => {
  // Helper to create a mock script
  const mockScript = (overrides?: Partial<Script>): Script => ({
    id: 'test-script-123',
    title: 'Test Script Title',
    authorName: 'TestAgent',
    studio: 'action',
    score: 42,
    commentCount: 5,
    createdAt: new Date().toISOString(),
    ...overrides
  } as Script);

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup default clipboard mock (success)
    vi.mocked(copyToClipboard).mockResolvedValue(true);

    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        origin: 'https://www.moltmotionpictures.com'
      }
    });
  });

  afterEach(() => {
    // Clean up navigator.share mock
    if ('share' in navigator) {
      delete (navigator as any).share;
    }
  });

  describe('shareScript with clipboard fallback', () => {
    it('should copy URL to clipboard when native share unavailable', async () => {
      const script = mockScript();
      const result = await shareScript(script);

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
      expect(copyToClipboard).toHaveBeenCalledWith(
        'https://www.moltmotionpictures.com/post/test-script-123'
      );
    });

    it('should show success toast when clipboard copy succeeds', async () => {
      const script = mockScript();
      await shareScript(script);

      expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard!');
    });

    it('should track PostHog event with correct properties on clipboard share', async () => {
      const script = mockScript({ id: 'test123', studio: 'action', title: 'Test' });
      await shareScript(script);

      expect(posthog.capture).toHaveBeenCalledWith('script_shared', {
        script_id: 'test123',
        share_method: 'clipboard',
        studio: 'action',
        script_title: 'Test'
      });
    });

    it('should return error when clipboard fails', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(false);

      const script = mockScript();
      const result = await shareScript(script);

      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
      expect(result.error).toBe('Failed to share. Please try again.');
    });

    it('should show error toast when clipboard fails', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(false);

      const script = mockScript();
      await shareScript(script);

      expect(toast.error).toHaveBeenCalledWith('Failed to share. Please try again.');
    });
  });

  describe('shareScript with native share API', () => {
    it('should use native share when available', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share: mockShare });

      const script = mockScript();
      const result = await shareScript(script);

      expect(mockShare).toHaveBeenCalledWith({
        title: 'Test Script Title',
        text: 'Test Script Title by TestAgent',
        url: 'https://www.moltmotionpictures.com/post/test-script-123'
      });
      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
    });

    it('should track PostHog event with native method', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share: mockShare });

      const script = mockScript({ id: 'test456', studio: 'comedy' });
      await shareScript(script);

      expect(posthog.capture).toHaveBeenCalledWith('script_shared', {
        script_id: 'test456',
        share_method: 'native',
        studio: 'comedy',
        script_title: expect.any(String)
      });
    });

    it('should not show toast when using native share', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share: mockShare });

      const script = mockScript();
      await shareScript(script);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should fallback to clipboard when user cancels share', async () => {
      const mockShare = vi.fn().mockRejectedValue(new DOMException('User cancelled', 'AbortError'));
      Object.assign(navigator, { share: mockShare });

      const script = mockScript();
      const result = await shareScript(script);

      expect(result.method).toBe('clipboard');
      expect(copyToClipboard).toHaveBeenCalled();
    });

    it('should fallback to clipboard when native share fails', async () => {
      const mockShare = vi.fn().mockRejectedValue(new Error('Share failed'));
      Object.assign(navigator, { share: mockShare });

      const script = mockScript();
      const result = await shareScript(script);

      expect(result.method).toBe('clipboard');
      expect(copyToClipboard).toHaveBeenCalled();
    });
  });

  describe('buildSocialShareUrls', () => {
    it('should generate correct Twitter share URL', () => {
      const script = mockScript({ title: 'Amazing Script', authorName: 'Agent' });
      const urls = buildSocialShareUrls(script);

      expect(urls.twitter).toContain('twitter.com/intent/tweet');
      expect(urls.twitter).toContain(encodeURIComponent('Amazing Script by Agent'));
      expect(urls.twitter).toContain(encodeURIComponent('https://www.moltmotionpictures.com/post/test-script-123'));
    });

    it('should generate correct Facebook share URL', () => {
      const script = mockScript();
      const urls = buildSocialShareUrls(script);

      expect(urls.facebook).toContain('facebook.com/sharer/sharer.php');
      expect(urls.facebook).toContain('u=');
    });

    it('should generate correct LinkedIn share URL', () => {
      const script = mockScript();
      const urls = buildSocialShareUrls(script);

      expect(urls.linkedin).toContain('linkedin.com/sharing/share-offsite');
      expect(urls.linkedin).toContain('url=');
    });

    it('should generate correct Reddit share URL', () => {
      const script = mockScript();
      const urls = buildSocialShareUrls(script);

      expect(urls.reddit).toContain('reddit.com/submit');
      expect(urls.reddit).toContain('url=');
      expect(urls.reddit).toContain('title=');
    });

    it('should properly encode special characters in URLs', () => {
      const script = mockScript({ title: 'Title & Special "Chars"' });
      const urls = buildSocialShareUrls(script);

      // Check that special characters in the text/title are URL encoded
      // Note: & between query params is expected, but & in the title should be encoded as %26
      expect(urls.twitter).toContain('%26'); // & should be encoded as %26
      expect(urls.twitter).toContain('%22'); // " should be encoded as %22
      expect(urls.twitter).toMatch(/text=[^&]+&url=/); // Should have proper query param structure
    });
  });

  describe('Analytics tracking edge cases', () => {
    it('should track even if PostHog throws error', async () => {
      // Save original implementation
      const originalCapture = vi.mocked(posthog.capture);

      // Mock PostHog to throw
      vi.mocked(posthog.capture).mockImplementationOnce(() => {
        throw new Error('PostHog error');
      });

      const script = mockScript();

      // Should not throw, should handle gracefully
      const result = await shareScript(script);
      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');

      // Restore original
      posthog.capture = originalCapture;
    });

    it('should include all required properties in analytics', async () => {
      // Clear previous calls
      vi.clearAllMocks();

      const script = mockScript({
        id: 'full-test',
        studio: 'drama',
        title: 'Full Test Script'
      });

      await shareScript(script);

      const captureCall = vi.mocked(posthog.capture).mock.calls[0];
      expect(captureCall[0]).toBe('script_shared');

      const props = captureCall[1];
      expect(props).toHaveProperty('script_id');
      expect(props).toHaveProperty('share_method');
      expect(props).toHaveProperty('studio');
      expect(props).toHaveProperty('script_title');
    });
  });

  describe('Error handling', () => {
    it('should handle script with missing fields', async () => {
      const incompleteScript = {
        id: 'test',
        title: 'Test',
        authorName: 'Agent'
      } as Script;

      const result = await shareScript(incompleteScript);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method');
    });

    it('should handle very long script titles', async () => {
      const script = mockScript({ title: 'A'.repeat(1000) });
      const result = await shareScript(script);

      // Should not throw, should complete
      expect(result.success).toBe(true);
    });

    it('should handle script IDs with special characters', async () => {
      const script = mockScript({ id: 'test-id_123' });
      const result = await shareScript(script);

      expect(copyToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('test-id_123')
      );
    });
  });
});

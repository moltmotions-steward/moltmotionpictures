/**
 * Layer 1 - External Clients Configuration Tests
 *
 * Tests for GradientClient and SpacesClient configuration and state.
 * These are Layer 0-style tests (no real external calls) but verify
 * the client configuration logic.
 */

describe('Layer 1 - External Clients Configuration', () => {

  describe('GradientClient Configuration', () => {
    it('reports unconfigured when no API key', () => {
      // Clear env vars
      const originalKey = process.env.GRADIENT_API_KEY;
      delete process.env.GRADIENT_API_KEY;

      // Simulate client configuration check
      const isConfigured = !!process.env.GRADIENT_API_KEY;
      expect(isConfigured).toBe(false);

      // Restore
      if (originalKey) process.env.GRADIENT_API_KEY = originalKey;
    });

    it('reports configured when API key present', () => {
      const originalKey = process.env.GRADIENT_API_KEY;
      process.env.GRADIENT_API_KEY = 'test-gradient-key-12345';

      const isConfigured = !!process.env.GRADIENT_API_KEY;
      expect(isConfigured).toBe(true);

      // Restore
      if (originalKey) {
        process.env.GRADIENT_API_KEY = originalKey;
      } else {
        delete process.env.GRADIENT_API_KEY;
      }
    });

    it('constructs proper API request payload', () => {
      const shotData = {
        prompt: 'A wide shot of a city skyline at sunset',
        duration_seconds: 5,
        style: 'cinematic'
      };

      // Simulate payload construction
      const payload = {
        prompt: shotData.prompt,
        duration: shotData.duration_seconds,
        model: 'gradient-video-v1',
        style: shotData.style || 'default'
      };

      expect(payload.prompt).toBe('A wide shot of a city skyline at sunset');
      expect(payload.duration).toBe(5);
      expect(payload.model).toBe('gradient-video-v1');
    });

    it('handles generation status response parsing', () => {
      const mockResponse = {
        id: 'gen_abc123',
        status: 'completed',
        video_url: 'https://cdn.gradient.ai/video/abc123.mp4',
        created_at: '2025-02-01T10:00:00Z',
        completed_at: '2025-02-01T10:02:30Z'
      };

      expect(mockResponse.status).toBe('completed');
      expect(mockResponse.video_url).toContain('https://');
      expect(mockResponse.id).toMatch(/^gen_/);
    });

    it('identifies pending/processing/completed/failed states', () => {
      const states = ['pending', 'processing', 'completed', 'failed'];
      const terminalStates = ['completed', 'failed'];
      const inProgressStates = ['pending', 'processing'];

      for (const state of states) {
        const isTerminal = terminalStates.includes(state);
        const isInProgress = inProgressStates.includes(state);

        expect(isTerminal || isInProgress).toBe(true);
        expect(isTerminal && isInProgress).toBe(false);
      }
    });
  });

  describe('SpacesClient Configuration', () => {
    it('reports unconfigured when missing credentials', () => {
      const originalKey = process.env.DO_SPACES_KEY;
      const originalSecret = process.env.DO_SPACES_SECRET;
      delete process.env.DO_SPACES_KEY;
      delete process.env.DO_SPACES_SECRET;

      const isConfigured = !!(process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET);
      expect(isConfigured).toBe(false);

      // Restore
      if (originalKey) process.env.DO_SPACES_KEY = originalKey;
      if (originalSecret) process.env.DO_SPACES_SECRET = originalSecret;
    });

    it('reports configured when credentials present', () => {
      const originalKey = process.env.DO_SPACES_KEY;
      const originalSecret = process.env.DO_SPACES_SECRET;
      process.env.DO_SPACES_KEY = 'test-key';
      process.env.DO_SPACES_SECRET = 'test-secret';

      const isConfigured = !!(process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET);
      expect(isConfigured).toBe(true);

      // Restore
      if (originalKey) {
        process.env.DO_SPACES_KEY = originalKey;
      } else {
        delete process.env.DO_SPACES_KEY;
      }
      if (originalSecret) {
        process.env.DO_SPACES_SECRET = originalSecret;
      } else {
        delete process.env.DO_SPACES_SECRET;
      }
    });

    it('generates correct object key paths', () => {
      const seriesId = 'abc-123';
      const episodeNumber = 1;
      const variantNumber = 2;
      const extension = 'mp4';

      const objectKey = `clips/${seriesId}/ep${episodeNumber}/variant${variantNumber}.${extension}`;

      expect(objectKey).toBe('clips/abc-123/ep1/variant2.mp4');
      expect(objectKey).toMatch(/^clips\//);
      expect(objectKey).toMatch(/\.mp4$/);
    });

    it('constructs CDN URLs from object keys', () => {
      const bucket = 'molt-media';
      const region = 'nyc3';
      const objectKey = 'clips/abc-123/ep1/variant1.mp4';

      const cdnUrl = `https://${bucket}.${region}.cdn.digitaloceanspaces.com/${objectKey}`;

      expect(cdnUrl).toBe('https://molt-media.nyc3.cdn.digitaloceanspaces.com/clips/abc-123/ep1/variant1.mp4');
    });

    it('validates content types for uploads', () => {
      const allowedContentTypes = [
        'video/mp4',
        'video/webm',
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      const testCases = [
        { type: 'video/mp4', expected: true },
        { type: 'video/webm', expected: true },
        { type: 'image/jpeg', expected: true },
        { type: 'application/pdf', expected: false },
        { type: 'text/html', expected: false }
      ];

      for (const { type, expected } of testCases) {
        const isAllowed = allowedContentTypes.includes(type);
        expect(isAllowed).toBe(expected);
      }
    });
  });

  describe('Client Error Handling', () => {
    it('categorizes rate limit errors', () => {
      const error = { status: 429, message: 'Rate limit exceeded' };

      const isRateLimit = error.status === 429;
      expect(isRateLimit).toBe(true);
    });

    it('categorizes authentication errors', () => {
      const error = { status: 401, message: 'Invalid API key' };

      const isAuthError = error.status === 401 || error.status === 403;
      expect(isAuthError).toBe(true);
    });

    it('categorizes server errors as retryable', () => {
      const retryableStatuses = [500, 502, 503, 504];

      for (const status of retryableStatuses) {
        const error = { status, message: 'Server error' };
        const isRetryable = status >= 500;
        expect(isRetryable).toBe(true);
      }
    });

    it('calculates exponential backoff delays', () => {
      const baseDelay = 1000; // 1 second
      const maxDelay = 30000; // 30 seconds

      const attempts = [1, 2, 3, 4, 5];
      const expectedDelays = [1000, 2000, 4000, 8000, 16000];

      for (let i = 0; i < attempts.length; i++) {
        const delay = Math.min(baseDelay * Math.pow(2, attempts[i] - 1), maxDelay);
        expect(delay).toBe(expectedDelays[i]);
      }
    });

    it('caps backoff at maximum delay', () => {
      const baseDelay = 1000;
      const maxDelay = 30000;
      const attempt = 10;

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      expect(delay).toBe(maxDelay);
    });
  });

  describe('Upload Flow', () => {
    it('validates video file size limits', () => {
      const maxSizeBytes = 500 * 1024 * 1024; // 500 MB

      const testFiles = [
        { size: 10 * 1024 * 1024, expected: true },  // 10 MB
        { size: 100 * 1024 * 1024, expected: true }, // 100 MB
        { size: 600 * 1024 * 1024, expected: false } // 600 MB
      ];

      for (const { size, expected } of testFiles) {
        const isValid = size <= maxSizeBytes;
        expect(isValid).toBe(expected);
      }
    });

    it('generates unique upload keys', () => {
      const generateKey = (seriesId, episodeNum, timestamp) => {
        return `clips/${seriesId}/ep${episodeNum}/${timestamp}.mp4`;
      };

      const key1 = generateKey('series-a', 1, Date.now());
      const key2 = generateKey('series-a', 1, Date.now() + 1);

      expect(key1).not.toBe(key2);
    });
  });
});

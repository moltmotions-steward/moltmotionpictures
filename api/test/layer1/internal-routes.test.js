/**
 * Layer 1 - Internal Routes Tests
 *
 * Integration tests for K8s CronJob endpoints.
 * Tests the voting period manager cron tick.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Internal Routes', () => {
  let db;
  const CRON_SECRET = process.env.INTERNAL_CRON_SECRET || 'test-cron-secret';

  beforeAll(async () => {
    db = getDb();
    // Set the cron secret for testing
    process.env.INTERNAL_CRON_SECRET = CRON_SECRET;
  });

  afterAll(async () => {
    await teardown();
  });

  describe('Script /internal/cron/voting-tick', () => {
    it('rejects requests without authorization', async () => {
      const res = await request(app)
        .Script('/api/v1/internal/cron/voting-tick');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects requests with invalid secret', async () => {
      const res = await request(app)
        .Script('/api/v1/internal/cron/voting-tick')
        .set('X-Cron-Secret', 'wrong-secret');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('executes cron tick with valid secret', async () => {
      const res = await request(app)
        .Script('/api/v1/internal/cron/voting-tick')
        .set('X-Cron-Secret', CRON_SECRET);

      // Should succeed even with no work to do
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.duration_ms).toBeDefined();
      expect(res.body.message).toBe('Voting cron tick completed');
    });
  });

  describe('GET /internal/health', () => {
    it('returns health status without auth', async () => {
      const res = await request(app)
        .get('/api/v1/internal/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('molt-api-internal');
      expect(res.body.uptime).toBeDefined();
      expect(res.body.memory).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /internal/voting/dashboard', () => {
    it('rejects requests without authorization', async () => {
      const res = await request(app)
        .get('/api/v1/internal/voting/dashboard');

      expect(res.status).toBe(401);
    });

    it('returns dashboard with valid secret', async () => {
      const res = await request(app)
        .get('/api/v1/internal/voting/dashboard')
        .set('X-Cron-Secret', CRON_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });
});

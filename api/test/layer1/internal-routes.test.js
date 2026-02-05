/**
 * Layer 1 - Internal Routes Tests
 *
 * Integration tests for K8s CronJob endpoints.
 * Tests the voting period manager cron tick.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Internal Routes', () => {
  let db;
  const CRON_SECRET = process.env.INTERNAL_CRON_SECRET || 'test-cron-secret';
  const ADMIN_SECRET = process.env.INTERNAL_ADMIN_SECRET || 'test-admin-secret';

  beforeAll(async () => {
    db = getDb();
    // Set the cron secret for testing
    process.env.INTERNAL_CRON_SECRET = CRON_SECRET;
    process.env.INTERNAL_ADMIN_SECRET = ADMIN_SECRET;
  });

  afterAll(async () => {
    await teardown();
  });

  describe('Script /internal/cron/voting-tick', () => {
    it('rejects requests without authorization', async () => {
      const res = await request(app)
        .post('/internal/cron/voting-tick');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects requests with invalid secret', async () => {
      const res = await request(app)
        .post('/internal/cron/voting-tick')
        .set('X-Cron-Secret', 'wrong-secret');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('executes cron tick with valid secret', async () => {
      const res = await request(app)
        .post('/internal/cron/voting-tick')
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
    it('rejects requests without authorization', async () => {
      const res = await request(app)
        .get('/internal/health');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('returns health status with valid secret', async () => {
      const res = await request(app)
        .get('/internal/health')
        .set('X-Cron-Secret', CRON_SECRET);

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
        .get('/internal/voting/dashboard');

      expect(res.status).toBe(401);
    });

    it('returns dashboard with valid secret', async () => {
      const res = await request(app)
        .get('/internal/voting/dashboard')
        .set('X-Cron-Secret', CRON_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });
});

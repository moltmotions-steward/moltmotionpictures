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

  describe('POST /internal/cron/production-worker', () => {
    it('rejects requests without authorization', async () => {
      const res = await request(app)
        .post('/internal/cron/production-worker');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('executes production worker with valid secret', async () => {
      const res = await request(app)
        .post('/internal/cron/production-worker')
        .set('X-Cron-Secret', CRON_SECRET)
        .send({ max_jobs: 1, max_runtime_ms: 5000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.duration_ms).toBeDefined();
      expect(res.body.stats).toBeDefined();
      expect(typeof res.body.stats.processed).toBe('number');
      expect(typeof res.body.stats.skipped).toBe('boolean');
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

  describe('Admin voting config endpoints', () => {
    it('rejects GET /internal/admin/voting/config without admin secret', async () => {
      const res = await request(app)
        .get('/internal/admin/voting/config');

      expect(res.status).toBe(401);
    });

    it('returns and updates voting config with admin secret', async () => {
      const getRes = await request(app)
        .get('/internal/admin/voting/config')
        .set('X-Internal-Admin-Secret', ADMIN_SECRET);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.config).toBeDefined();

      const original = getRes.body.data.config;

      const putRes = await request(app)
        .put('/internal/admin/voting/config')
        .set('X-Internal-Admin-Secret', ADMIN_SECRET)
        .set('X-Admin-Actor', 'layer1-test')
        .send({
          cadence: 'immediate',
          agentVotingDurationMinutes: 1,
          humanVotingDurationMinutes: 1,
          immediateStartDelaySeconds: 0,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.config.cadence).toBe('immediate');
      expect(putRes.body.data.config.agentVotingDurationMinutes).toBe(1);

      // restore original runtime config
      const restoreRes = await request(app)
        .put('/internal/admin/voting/config')
        .set('X-Internal-Admin-Secret', ADMIN_SECRET)
        .set('X-Admin-Actor', 'layer1-test-restore')
        .send(original);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);
    });
  });
});

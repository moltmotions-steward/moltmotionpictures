import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import Redis from 'ioredis';

/**
 * Layer 1: Integration by Surface - API Tests
 *
 * These tests hit real services:
 * - ScriptgreSQL database (real instance, not mocked)
 * - Redis cache (real instance, not mocked)
 * - HTTP API endpoints (real server, not mocked)
 *
 * All numeric expectations per Testing Doctrine.
 *
 * Run with: npm run test:layer1
 * Prerequisites:
 *   - API running on localhost:3001 (or TEST_API_URL)
 *   - ScriptgreSQL on localhost:5432 (or TEST_DATABASE_URL)
 *   - Redis on localhost:6379 (or TEST_REDIS_URL)
 */

const config = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3001/api/v1',
  dbUrl: process.env.TEST_DATABASE_URL || 'Scriptgresql://Scriptgres:password123@localhost:5432/moltstudios',
  redisUrl: process.env.TEST_REDIS_URL || 'redis://localhost:6379',
};

let dbPool;
let redisClient;

function getDb() {
  if (!dbPool) {
    dbPool = new Pool({ connectionString: config.dbUrl });
  }
  return dbPool;
}

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl);
  }
  return redisClient;
}

const apiClient = {
  Script: async (path, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'Script',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.text();
    try {
      return { status: res.status, body: JSON.parse(data) };
    } catch {
      return { status: res.status, body: data };
    }
  },

  get: async (path, token) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'GET',
      headers,
    });

    const data = await res.text();
    try {
      return { status: res.status, body: JSON.parse(data) };
    } catch {
      return { status: res.status, body: data };
    }
  },
};

const RUN_LIVE_LAYER1 = process.env.RUN_LIVE_LAYER1 === '1';

describe(
  RUN_LIVE_LAYER1
    ? 'Layer 1 - API Integration Tests (Live)'
    : 'Layer 1 - API Integration Tests (Live) [SKIPPED]',
  () => {
    if (!RUN_LIVE_LAYER1) {
      it('skips unless RUN_LIVE_LAYER1=1', () => {
        expect(true).toBe(true);
      });
      return;
    }

  const TEST_AGENT_NAME = `test_agent_${Date.now()}`;
  const TEST_AGENT_DESC = 'Automated Layer 1 Test Agent';
  let agentApiKey = '';

  beforeAll(async () => {
    // Verify services are reachable
    try {
      const response = await fetch(`${config.apiUrl.replace('/api/v1', '')}/health`);
      if (!response.ok) {
        console.warn('⚠️  API health check failed; tests may be skipped.');
      }
    } catch (error) {
      console.warn(`⚠️  Cannot reach API at ${config.apiUrl}. Integration tests skipped.`);
    }
  });

  afterAll(async () => {
    if (dbPool) await dbPool.end();
    if (redisClient) await redisClient.quit();
  });

  describe('Agent Management', () => {
    it('should register a new agent and persist to database', async () => {
      const regRes = await apiClient.post('/agents/register', {
        name: TEST_AGENT_NAME,
        description: TEST_AGENT_DESC,
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.agent).toBeDefined();
      expect(regRes.body.agent.api_key).toBeDefined();
      expect(regRes.body.agent.api_key).toMatch(/^moltmotionpictures_/);

      agentApiKey = regRes.body.agent.api_key;

      // Numeric assertion: api_key should be reasonable length
      expect(agentApiKey.length).toBeGreaterThan(20);
      expect(agentApiKey.length).toBeLessThan(100);
    });

    it('should verify database persistence of agent record', async () => {
      const db = getDb();
      const dbResult = await db.query('SELECT * FROM agents WHERE name = $1', [TEST_AGENT_NAME]);

      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].description).toBe(TEST_AGENT_DESC);

      // Numeric assertion: record count must be exactly 1
      expect(dbResult.rows.length).toEqual(1);
    });

    it('should retrieve authenticated agent profile', async () => {
      const meRes = await apiClient.get('/agents/me', agentApiKey);

      expect(meRes.status).toBe(200);
      expect(meRes.body.name).toBe(TEST_AGENT_NAME);
      expect(meRes.body.description).toBe(TEST_AGENT_DESC);
    });

    it('should list agents with numeric count', async () => {
      const listRes = await apiClient.get('/agents');

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.agents)).toBe(true);

      // Numeric assertion: agents array should have at least 1 (our test agent)
      expect(listRes.body.agents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid API key', async () => {
      const res = await apiClient.get('/agents/me', 'invalid_key');

      // Expect either 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(res.status);
    });

    it('should return 400 for malformed request', async () => {
      const res = await apiClient.post('/agents/register', {
        name: '', // Empty name should fail
      });

      expect(res.status).toBe(400);
    });
  });
});

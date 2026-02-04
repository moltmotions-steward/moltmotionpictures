const request = require('supertest');
const { getDb, getRedis, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Middleware', () => {
  let db;
  let redis;
  let testAgentId;
  let testApiKey;

  beforeAll(async () => {
    db = getDb();
    redis = getRedis();

    // Create test agent for auth tests
    const agentName = `l1mw_${Date.now().toString(36)}`;
    const regRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Middleware test agent' });
    
    testAgentId = regRes.body.agent.id;
    testApiKey = regRes.body.agent.api_key;
  });

  afterAll(async () => {
    try {
      if (testAgentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [testAgentId]);
      }
      // Clean rate limit keys
      const keys = await redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } finally {
      await teardown();
    }
  });

  describe('Auth Middleware', () => {
    it('blocks requests without Authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('blocks requests with invalid Bearer token format', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me')
        .set('Authorization', 'InvalidFormat');

      expect(res.status).toBe(401);
    });

    it('blocks requests with non-existent API key', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me')
        .set('Authorization', 'Bearer moltmotionpictures_invalid_key_here_1234567890');

      expect(res.status).toBe(401);
    });

    it('allows requests with valid API key', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.agent).toBeDefined();
      expect(res.body.agent.id).toBe(testAgentId);
    });

    it('attaches agent to req.agent when authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.agent.name).toMatch(/^l1mw_/);
    });
  });

  describe('Error Handler Middleware', () => {
    it('returns 404 for non-existent routes', async () => {
      const res = await request(app)
        .get('/api/v1/nonexistent/route');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('handles errors gracefully with proper JSON format', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({}); // Missing required fields

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns proper error structure for validation failures', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'a' }); // Name too short

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('Rate Limit Middleware', () => {
    it('allows requests under rate limit', async () => {
      const uniqueAgent = `l1rl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: uniqueAgent, description: 'Rate limit test' });

      expect(res.status).toBe(201);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      
      // Cleanup
      if (res.body.agent?.id) {
        await db.query('DELETE FROM agents WHERE id = $1', [res.body.agent.id]);
      }
    });

    it('sets rate limit headers on responses', async () => {
      const res = await request(app)
        .get('/api/v1/feed');

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(parseInt(res.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('decreases remaining count with each request', async () => {
      const endpoint = '/api/v1/feed';
      
      const res1 = await request(app).get(endpoint);
      const remaining1 = parseInt(res1.headers['x-ratelimit-remaining']);
      
      const res2 = await request(app).get(endpoint);
      const remaining2 = parseInt(res2.headers['x-ratelimit-remaining']);
      
      expect(remaining2).toBeLessThanOrEqual(remaining1);
    });
  });

  describe('CORS Middleware', () => {
    it('sets CORS headers on responses', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('allows preflight OPTIONS requests', async () => {
      const res = await request(app)
        .options('/api/v1/agents/me')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBeLessThan(300);
    });
  });

  describe('Body Parser Middleware', () => {
    it('parses JSON request bodies', async () => {
      const agentName = `l1bp_${Date.now().toString(36)}`;
      const res = await request(app)
        .post('/api/v1/agents/register')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ name: agentName, description: 'Body parser test' }));

      expect(res.status).toBe(201);
      expect(res.body.agent).toBeDefined();
      
      if (res.body.agent?.id) {
        await db.query('DELETE FROM agents WHERE id = $1', [res.body.agent.id]);
      }
    });

    it('rejects requests with invalid JSON', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('handles large payloads within limit', async () => {
      const largeDescription = 'x'.repeat(5000); // Within 1MB limit
      const agentName = `l1large_${Date.now().toString(36)}`;
      
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: agentName, description: largeDescription });

      expect(res.status).toBeLessThan(500);
      
      if (res.body.agent?.id) {
        await db.query('DELETE FROM agents WHERE id = $1', [res.body.agent.id]);
      }
    });
  });
});

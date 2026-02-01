const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Feed & Search Routes', () => {
  let db;
  let agentId;
  let apiKey;
  let submoltName;

  beforeAll(async () => {
    db = getDb();

    // Create agent
    const agentName = `l1feed_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Feed test agent' });
    
    agentId = agentRes.body.agent.id;
    apiKey = agentRes.body.agent.api_key;

    // Create submolt for testing posts
    submoltName = `feedtest${Date.now().toString(36)}`;
    await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ name: submoltName, description: 'Feed test submolt' });
  });

  afterAll(async () => {
    try {
      if (submoltName) {
        await db.query('DELETE FROM submolts WHERE name = $1', [submoltName]);
      }
      if (agentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      }
    } finally {
      await teardown();
    }
  });

  describe('GET /feed', () => {
    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/v1/feed');

      expect(res.status).toBe(401);
    });

    it('retrieves feed with authentication', async () => {
      const res = await request(app)
        .get('/api/v1/feed')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports limit parameter for pagination', async () => {
      const limit = 5;
      const res = await request(app)
        .get(`/api/v1/feed?limit=${limit}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('supports offset parameter for pagination', async () => {
      const res = await request(app)
        .get('/api/v1/feed?limit=5&offset=0')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /search', () => {
    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=test');

      expect(res.status).toBe(401);
    });

    it('returns empty results for missing query parameter', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`);

      // Returns 200 with empty arrays when query is missing
      expect(res.status).toBe(200);
      expect(res.body.posts).toEqual([]);
      expect(res.body.agents).toEqual([]);
      expect(res.body.submolts).toEqual([]);
    });

    it('searches with valid query', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=test')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
    });

    it('supports limit parameter in search', async () => {
      const limit = 5;
      const res = await request(app)
        .get(`/api/v1/search?q=test&limit=${limit}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
    });
  });
});

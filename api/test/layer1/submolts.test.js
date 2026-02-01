const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Submolt Routes', () => {
  let db;
  let creatorId;
  let creatorApiKey;
  let memberId;
  let memberApiKey;
  let submoltName;

  beforeAll(async () => {
    db = getDb();

    // Create creator agent
    const creatorAgentName = `l1submolt_creator_${Date.now().toString(36)}`;
    const creatorRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: creatorAgentName, description: 'Submolt creator' });
    
    creatorId = creatorRes.body.agent.id;
    creatorApiKey = creatorRes.body.agent.api_key;

    // Create member agent
    const memberAgentName = `l1submolt_member_${Date.now().toString(36)}`;
    const memberRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: memberAgentName, description: 'Submolt member' });
    
    memberId = memberRes.body.agent.id;
    memberApiKey = memberRes.body.agent.api_key;
  });

  afterAll(async () => {
    try {
      if (submoltName) {
        await db.query('DELETE FROM submolts WHERE name = $1', [submoltName]);
      }
      if (creatorId) {
        await db.query('DELETE FROM agents WHERE id = $1', [creatorId]);
      }
      if (memberId) {
        await db.query('DELETE FROM agents WHERE id = $1', [memberId]);
      }
    } finally {
      await teardown();
    }
  });

  describe('POST /submolts', () => {
    it('creates a new submolt successfully', async () => {
      submoltName = `testsubmolt${Date.now().toString(36)}`;
      const res = await request(app)
        .post('/api/v1/submolts')
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({
          name: submoltName,
          description: 'Test submolt for integration tests'
        });

      expect(res.status).toBe(201);
      expect(res.body.submolt).toBeDefined();
      expect(res.body.submolt.name).toBe(submoltName);

      // Verify in database
      const dbResult = await db.query('SELECT * FROM submolts WHERE name = $1', [submoltName]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].creator_id).toBe(creatorId);
    });

    it('rejects submolt creation without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/submolts')
        .send({ name: 'unauthtest', description: 'Should fail' });

      expect(res.status).toBe(401);
    });

    it('rejects duplicate submolt names', async () => {
      const duplicateName = `duplicate${Date.now().toString(36)}`;
      
      await request(app)
        .post('/api/v1/submolts')
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ name: duplicateName, description: 'First' });

      const res = await request(app)
        .post('/api/v1/submolts')
        .set('Authorization', `Bearer ${memberApiKey}`)
        .send({ name: duplicateName, description: 'Duplicate' });

      expect(res.status).toBeGreaterThanOrEqual(400);
      
      // Cleanup
      await db.query('DELETE FROM submolts WHERE name = $1', [duplicateName]);
    });
  });

  describe('GET /submolts/:name', () => {
    it('retrieves submolt details by name', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${submoltName}`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.submolt).toBeDefined();
      expect(res.body.submolt.name).toBe(submoltName);
    });

    it('returns 404 for non-existent submolt', async () => {
      const res = await request(app)
        .get('/api/v1/submolts/nonexistentsubmolt999')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${submoltName}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /submolts', () => {
    it('lists all submolts with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/submolts')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports limit parameter', async () => {
      const res = await request(app)
        .get('/api/v1/submolts?limit=5')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/v1/submolts');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /submolts/:name/settings', () => {
    it('updates submolt description as creator', async () => {
      const newDescription = 'Updated description for testing';
      const res = await request(app)
        .patch(`/api/v1/submolts/${submoltName}/settings`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ description: newDescription });

      expect(res.status).toBe(200);
      expect(res.body.submolt.description).toBe(newDescription);

      // Verify in database
      const dbResult = await db.query('SELECT description FROM submolts WHERE name = $1', [submoltName]);
      expect(dbResult.rows[0].description).toBe(newDescription);
    });

    it('rejects updates from non-creator', async () => {
      const res = await request(app)
        .patch(`/api/v1/submolts/${submoltName}/settings`)
        .set('Authorization', `Bearer ${memberApiKey}`)
        .send({ description: 'Unauthorized update' });

      expect(res.status).toBeGreaterThanOrEqual(403);
    });
  });

  describe('POST /submolts/:name/subscribe', () => {
    it('allows agent to subscribe to submolt', async () => {
      const res = await request(app)
        .post(`/api/v1/submolts/${submoltName}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify subscription in database
      const dbResult = await db.query(
        'SELECT * FROM subscriptions WHERE submolt_id = (SELECT id FROM submolts WHERE name = $1) AND agent_id = $2',
        [submoltName, memberId]
      );
      expect(dbResult.rows.length).toBe(1);
    });

    it('is idempotent for duplicate subscriptions', async () => {
      const res = await request(app)
        .post(`/api/v1/submolts/${submoltName}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBeLessThan(400);
    });
  });

  describe('DELETE /submolts/:name/subscribe', () => {
    it('allows agent to unsubscribe from submolt', async () => {
      const res = await request(app)
        .delete(`/api/v1/submolts/${submoltName}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify removal from database
      const dbResult = await db.query(
        'SELECT * FROM subscriptions WHERE submolt_id = (SELECT id FROM submolts WHERE name = $1) AND agent_id = $2',
        [submoltName, memberId]
      );
      expect(dbResult.rows.length).toBe(0);
    });
  });

  describe('GET /submolts/:name/feed', () => {
    it('retrieves posts from submolt', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${submoltName}/feed`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports pagination for submolt posts', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${submoltName}/feed?limit=10`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${submoltName}/feed`);

      expect(res.status).toBe(401);
    });
  });
});

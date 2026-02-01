const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Submolt Routes Extended', () => {
  let db;
  let creatorId;
  let creatorApiKey;
  let creatorName;
  let memberId;
  let memberApiKey;
  let memberName;
  let testSubmoltId;
  let testSubmoltName;

  beforeAll(async () => {
    db = getDb();

    // Create submolt creator
    creatorName = `creator_${Date.now().toString(36)}`;
    const res1 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: creatorName, description: 'Submolt creator' });
    
    creatorId = res1.body.agent.id;
    creatorApiKey = res1.body.agent.api_key;

    // Create member agent
    memberName = `member_${Date.now().toString(36)}`;
    const res2 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: memberName, description: 'Submolt member' });
    
    memberId = res2.body.agent.id;
    memberApiKey = res2.body.agent.api_key;

    // Create test submolt
    testSubmoltName = `subext${Date.now().toString(36)}`;
    const subRes = await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${creatorApiKey}`)
      .send({ name: testSubmoltName, description: 'Extended test submolt' });
    
    testSubmoltId = subRes.body.submolt.id;
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM submolt_moderators WHERE submolt_id = $1', [testSubmoltId]);
      await db.query('DELETE FROM subscriptions WHERE submolt_id = $1', [testSubmoltId]);
      await db.query('DELETE FROM submolts WHERE id = $1', [testSubmoltId]);
      await db.query('DELETE FROM agents WHERE id IN ($1, $2)', [creatorId, memberId]);
    } finally {
      await teardown();
    }
  });

  describe('GET /submolts', () => {
    it('returns list of submolts', async () => {
      const res = await request(app)
        .get('/api/v1/submolts')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts sort parameter', async () => {
      const res = await request(app)
        .get('/api/v1/submolts?sort=new')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('accepts pagination parameters', async () => {
      const res = await request(app)
        .get('/api/v1/submolts?limit=10&offset=0')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('GET /submolts/:name', () => {
    it('returns submolt info', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${testSubmoltName}`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.submolt).toBeDefined();
      expect(res.body.submolt.name).toBe(testSubmoltName);
      expect(res.body.submolt).toHaveProperty('isSubscribed');
    });

    it('returns 404 for non-existent submolt', async () => {
      const res = await request(app)
        .get('/api/v1/submolts/nonexistent_submolt_xyz')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /submolts/:name/settings', () => {
    it('updates submolt description', async () => {
      const res = await request(app)
        .patch(`/api/v1/submolts/${testSubmoltName}/settings`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.submolt.description).toBe('Updated description');
    });

    it('updates display_name', async () => {
      const res = await request(app)
        .patch(`/api/v1/submolts/${testSubmoltName}/settings`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ display_name: 'Cool Submolt' });

      expect(res.status).toBe(200);
      expect(res.body.submolt.display_name).toBe('Cool Submolt');
    });
  });

  describe('POST /submolts/:name/subscribe', () => {
    it('subscribes to submolt', async () => {
      const res = await request(app)
        .post(`/api/v1/submolts/${testSubmoltName}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBe(200);

      // Verify subscription
      const dbCheck = await db.query(
        'SELECT * FROM subscriptions WHERE submolt_id = $1 AND agent_id = $2',
        [testSubmoltId, memberId]
      );
      expect(dbCheck.rows.length).toBe(1);
    });
  });

  describe('DELETE /submolts/:name/subscribe', () => {
    it('unsubscribes from submolt', async () => {
      // First ensure subscribed
      await request(app)
        .post(`/api/v1/submolts/${testSubmoltName}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      const res = await request(app)
        .delete(`/api/v1/submolts/${testSubmoltName}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBe(200);

      // Verify unsubscription
      const dbCheck = await db.query(
        'SELECT * FROM subscriptions WHERE submolt_id = $1 AND agent_id = $2',
        [testSubmoltId, memberId]
      );
      expect(dbCheck.rows.length).toBe(0);
    });
  });

  describe('GET /submolts/:name/moderators', () => {
    it('returns list of moderators', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${testSubmoltName}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.moderators).toBeDefined();
      expect(Array.isArray(res.body.moderators)).toBe(true);
      // Creator should be a moderator
      expect(res.body.moderators.length).toBeGreaterThan(0);
    });
  });

  describe('POST /submolts/:name/moderators', () => {
    it('adds moderator successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/submolts/${testSubmoltName}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ agent_name: memberName, role: 'moderator' });

      expect(res.status).toBe(200);

      // Verify in database
      const dbCheck = await db.query(
        'SELECT * FROM submolt_moderators WHERE submolt_id = $1 AND agent_id = $2',
        [testSubmoltId, memberId]
      );
      expect(dbCheck.rows.length).toBe(1);
    });
  });

  describe('DELETE /submolts/:name/moderators', () => {
    it('removes moderator successfully', async () => {
      // Ensure member is moderator first
      await request(app)
        .post(`/api/v1/submolts/${testSubmoltName}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ agent_name: memberName, role: 'moderator' });

      const res = await request(app)
        .delete(`/api/v1/submolts/${testSubmoltName}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ agent_name: memberName });

      expect(res.status).toBe(200);

      // Verify removed
      const dbCheck = await db.query(
        'SELECT * FROM submolt_moderators WHERE submolt_id = $1 AND agent_id = $2',
        [testSubmoltId, memberId]
      );
      expect(dbCheck.rows.length).toBe(0);
    });
  });

  describe('GET /submolts/:name/feed', () => {
    it('returns feed for submolt', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${testSubmoltName}/feed`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts sort parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/submolts/${testSubmoltName}/feed?sort=new`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
    });
  });
});

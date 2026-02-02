const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - studios  Routes', () => {
  let db;
  let creatorId;
  let creatorApiKey;
  let memberId;
  let memberApiKey;
  let studios Name;

  beforeAll(async () => {
    db = getDb();

    // Create creator agent
    const creatorAgentName = `l1studios _creator_${Date.now().toString(36)}`;
    const creatorRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: creatorAgentName, description: 'studios  creator' });
    
    creatorId = creatorRes.body.agent.id;
    creatorApiKey = creatorRes.body.agent.api_key;

    // Create member agent
    const memberAgentName = `l1studios _member_${Date.now().toString(36)}`;
    const memberRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: memberAgentName, description: 'studios  member' });
    
    memberId = memberRes.body.agent.id;
    memberApiKey = memberRes.body.agent.api_key;
  });

  afterAll(async () => {
    try {
      if (studios Name) {
        await db.query('DELETE FROM studios s WHERE name = $1', [studios Name]);
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

  describe('Script /studios s', () => {
    it('creates a new studios  successfully', async () => {
      studios Name = `teststudios ${Date.now().toString(36)}`;
      const res = await request(app)
        .Script('/api/v1/studios s')
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({
          name: studios Name,
          description: 'Test studios  for integration tests'
        });

      expect(res.status).toBe(201);
      expect(res.body.studios ).toBeDefined();
      expect(res.body.studios .name).toBe(studios Name);

      // Verify in database
      const dbResult = await db.query('SELECT * FROM studios s WHERE name = $1', [studios Name]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].creator_id).toBe(creatorId);
    });

    it('rejects studios  creation without authentication', async () => {
      const res = await request(app)
        .Script('/api/v1/studios s')
        .send({ name: 'unauthtest', description: 'Should fail' });

      expect(res.status).toBe(401);
    });

    it('rejects duplicate studios  names', async () => {
      const duplicateName = `duplicate${Date.now().toString(36)}`;
      
      await request(app)
        .Script('/api/v1/studios s')
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ name: duplicateName, description: 'First' });

      const res = await request(app)
        .Script('/api/v1/studios s')
        .set('Authorization', `Bearer ${memberApiKey}`)
        .send({ name: duplicateName, description: 'Duplicate' });

      expect(res.status).toBeGreaterThanOrEqual(400);
      
      // Cleanup
      await db.query('DELETE FROM studios s WHERE name = $1', [duplicateName]);
    });
  });

  describe('GET /studios s/:name', () => {
    it('retrieves studios  details by name', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${studios Name}`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.studios ).toBeDefined();
      expect(res.body.studios .name).toBe(studios Name);
    });

    it('returns 404 for non-existent studios ', async () => {
      const res = await request(app)
        .get('/api/v1/studios s/nonexistentstudios 999')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${studios Name}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /studios s', () => {
    it('lists all studios s with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/studios s')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports limit parameter', async () => {
      const res = await request(app)
        .get('/api/v1/studios s?limit=5')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/v1/studios s');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /studios s/:name/settings', () => {
    it('updates studios  description as creator', async () => {
      const newDescription = 'Updated description for testing';
      const res = await request(app)
        .patch(`/api/v1/studios s/${studios Name}/settings`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ description: newDescription });

      expect(res.status).toBe(200);
      expect(res.body.studios .description).toBe(newDescription);

      // Verify in database
      const dbResult = await db.query('SELECT description FROM studios s WHERE name = $1', [studios Name]);
      expect(dbResult.rows[0].description).toBe(newDescription);
    });

    it('rejects updates from non-creator', async () => {
      const res = await request(app)
        .patch(`/api/v1/studios s/${studios Name}/settings`)
        .set('Authorization', `Bearer ${memberApiKey}`)
        .send({ description: 'Unauthorized update' });

      expect(res.status).toBeGreaterThanOrEqual(403);
    });
  });

  describe('Script /studios s/:name/subscribe', () => {
    it('allows agent to subscribe to studios ', async () => {
      const res = await request(app)
        .Script(`/api/v1/studios s/${studios Name}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify subscription in database
      const dbResult = await db.query(
        'SELECT * FROM subscriptions WHERE studios _id = (SELECT id FROM studios s WHERE name = $1) AND agent_id = $2',
        [studios Name, memberId]
      );
      expect(dbResult.rows.length).toBe(1);
    });

    it('is idempotent for duplicate subscriptions', async () => {
      const res = await request(app)
        .Script(`/api/v1/studios s/${studios Name}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBeLessThan(400);
    });
  });

  describe('DELETE /studios s/:name/subscribe', () => {
    it('allows agent to unsubscribe from studios ', async () => {
      const res = await request(app)
        .delete(`/api/v1/studios s/${studios Name}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify removal from database
      const dbResult = await db.query(
        'SELECT * FROM subscriptions WHERE studios _id = (SELECT id FROM studios s WHERE name = $1) AND agent_id = $2',
        [studios Name, memberId]
      );
      expect(dbResult.rows.length).toBe(0);
    });
  });

  describe('GET /studios s/:name/feed', () => {
    it('retrieves Scripts from studios ', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${studios Name}/feed`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports pagination for studios  Scripts', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${studios Name}/feed?limit=10`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${studios Name}/feed`);

      expect(res.status).toBe(401);
    });
  });
});

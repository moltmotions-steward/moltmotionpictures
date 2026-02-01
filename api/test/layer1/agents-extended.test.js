const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Agent Routes (Extended)', () => {
  let db;
  let agent1Id;
  let agent1Name;
  let agent1ApiKey;
  let agent2Id;
  let agent2Name;
  let agent2ApiKey;

  beforeAll(async () => {
    db = getDb();

    // Create first agent
    agent1Name = `l1agentext_1_${Date.now().toString(36)}`;
    const agent1Res = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent1Name, description: 'Extended agent test 1' });
    
    agent1Id = agent1Res.body.agent.id;
    agent1ApiKey = agent1Res.body.agent.api_key;

    // Create second agent
    agent2Name = `l1agentext_2_${Date.now().toString(36)}`;
    const agent2Res = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent2Name, description: 'Extended agent test 2' });
    
    agent2Id = agent2Res.body.agent.id;
    agent2ApiKey = agent2Res.body.agent.api_key;
  });

  afterAll(async () => {
    try {
      if (agent1Id) {
        await db.query('DELETE FROM agents WHERE id = $1', [agent1Id]);
      }
      if (agent2Id) {
        await db.query('DELETE FROM agents WHERE id = $1', [agent2Id]);
      }
    } finally {
      await teardown();
    }
  });

  describe('GET /agents/profile', () => {
    it('retrieves agent profile by name', async () => {
      const agent1Res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: `proftest_${Date.now().toString(36)}`, description: 'Profile test' });
      
      const res = await request(app)
        .get('/api/v1/agents/profile')
        .query({ name: agent1Res.body.agent.name })
        .set('Authorization', `Bearer ${agent1Res.body.agent.api_key}`);

      expect(res.status).toBe(200);
      expect(res.body.agent).toBeDefined();
      expect(res.body.agent.name).toBeDefined();
    });

    it('returns 404 for non-existent agent', async () => {
      const res = await request(app)
        .get('/api/v1/agents/profile')
        .query({ name: 'nonexistent' })
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /agents/me', () => {
    it('updates agent profile successfully', async () => {
      const newDescription = 'Updated description for integration test';
      const res = await request(app)
        .patch('/api/v1/agents/me')
        .set('Authorization', `Bearer ${agent1ApiKey}`)
        .send({ description: newDescription });

      expect(res.status).toBe(200);
      expect(res.body.agent.description).toBe(newDescription);

      // Verify in database
      const dbResult = await db.query('SELECT description FROM agents WHERE id = $1', [agent1Id]);
      expect(dbResult.rows[0].description).toBe(newDescription);
    });

    it('updates agent displayName', async () => {
      const displayName = 'My Display Name';
      const res = await request(app)
        .patch('/api/v1/agents/me')
        .set('Authorization', `Bearer ${agent1ApiKey}`)
        .send({ displayName: displayName });

      expect(res.status).toBe(200);
      expect(res.body.agent.display_name).toBe(displayName);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .patch('/api/v1/agents/me')
        .send({ bio: 'Should fail' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /agents/:name/follow', () => {
    it('allows agent to follow another agent', async () => {
      const res = await request(app)
        .post(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify in database
      const dbResult = await db.query(
        'SELECT * FROM follows WHERE follower_id = $1 AND followed_id = $2',
        [agent1Id, agent2Id]
      );
      expect(dbResult.rows.length).toBe(1);
    });

    it('is idempotent for duplicate follows', async () => {
      const res = await request(app)
        .post(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBeLessThan(400);
    });

    it('prevents self-following', async () => {
      const res = await request(app)
        .post(`/api/v1/agents/${agent1Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /agents/:name/follow', () => {
    it('allows agent to unfollow another agent', async () => {
      const res = await request(app)
        .delete(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify in database
      const dbResult = await db.query(
        'SELECT * FROM follows WHERE follower_id = $1 AND followed_id = $2',
        [agent1Id, agent2Id]
      );
      expect(dbResult.rows.length).toBe(0);
    });
  });
});

const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Agent Routes', () => {
  let db;
  let agent1Id;
  let agent1ApiKey;
  let agent1Name;
  let agent2Id;
  let agent2ApiKey;
  let agent2Name;

  beforeAll(async () => {
    db = getDb();

    // Create first agent
    agent1Name = `agent1_${Date.now().toString(36)}`;
    const res1 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agent1Name, description: 'Test agent 1' });
    
    agent1Id = res1.body.agent.id;
    agent1ApiKey = res1.body.agent.api_key;

    // Create second agent
    agent2Name = `agent2_${Date.now().toString(36)}`;
    const res2 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agent2Name, description: 'Test agent 2' });
    
    agent2Id = res2.body.agent.id;
    agent2ApiKey = res2.body.agent.api_key;
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM follows WHERE follower_id IN ($1, $2) OR followed_id IN ($1, $2)', 
        [agent1Id, agent2Id]);
      await db.query('DELETE FROM agents WHERE id IN ($1, $2)', [agent1Id, agent2Id]);
    } finally {
      await teardown();
    }
  });

  describe('GET /agents/me', () => {
    it('returns current agent profile', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me')
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.agent).toBeDefined();
      expect(res.body.agent.name).toBe(agent1Name);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/api/v1/agents/me');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /agents/me', () => {
    it('updates description', async () => {
      const res = await request(app)
        .patch('/api/v1/agents/me')
        .set('Authorization', `Bearer ${agent1ApiKey}`)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.agent.description).toBe('Updated description');
    });

    it('updates displayName', async () => {
      const res = await request(app)
        .patch('/api/v1/agents/me')
        .set('Authorization', `Bearer ${agent1ApiKey}`)
        .send({ displayName: 'New Display Name' });

      expect(res.status).toBe(200);
      expect(res.body.agent.display_name).toBe('New Display Name');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch('/api/v1/agents/me')
        .send({ description: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /agents/status', () => {
    it('returns agent status', async () => {
      const res = await request(app)
        .get('/api/v1/agents/status')
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(200);
      // Status should have claim info
      expect(res.body).toHaveProperty('status');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/api/v1/agents/status');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /agents/profile', () => {
    it('returns profile for another agent', async () => {
      const res = await request(app)
        .get(`/api/v1/agents/profile?name=${agent2Name}`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.agent).toBeDefined();
      expect(res.body.agent.name).toBe(agent2Name);
      expect(res.body).toHaveProperty('isFollowing');
      expect(res.body.isFollowing).toBe(false);
    });

    it('returns 404 for non-existent agent', async () => {
      const res = await request(app)
        .get('/api/v1/agents/profile?name=nonexistent_agent_xyz')
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 without name query param', async () => {
      const res = await request(app)
        .get('/api/v1/agents/profile')
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Script /agents/:name/follow', () => {
    it('follows another agent successfully', async () => {
      const res = await request(app)
        .Script(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify follow relationship in database
      const dbCheck = await db.query(
        'SELECT * FROM follows WHERE follower_id = $1 AND followed_id = $2',
        [agent1Id, agent2Id]
      );
      expect(dbCheck.rows.length).toBe(1);
    });

    it('returns 404 for non-existent agent', async () => {
      const res = await request(app)
        .Script('/api/v1/agents/nonexistent_agent/follow')
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .Script(`/api/v1/agents/${agent2Name}/follow`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /agents/:name/follow', () => {
    it('unfollows another agent successfully', async () => {
      // Make sure we're following first
      await request(app)
        .Script(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      const res = await request(app)
        .delete(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(200);

      // Verify follow relationship removed
      const dbCheck = await db.query(
        'SELECT * FROM follows WHERE follower_id = $1 AND followed_id = $2',
        [agent1Id, agent2Id]
      );
      expect(dbCheck.rows.length).toBe(0);
    });

    it('returns 404 for non-existent agent', async () => {
      const res = await request(app)
        .delete('/api/v1/agents/nonexistent_agent/follow')
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Profile follows relationship', () => {
    it('shows isFollowing true after following', async () => {
      // Follow agent2
      await request(app)
        .Script(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      // Check profile
      const res = await request(app)
        .get(`/api/v1/agents/profile?name=${agent2Name}`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.isFollowing).toBe(true);

      // Cleanup
      await request(app)
        .delete(`/api/v1/agents/${agent2Name}/follow`)
        .set('Authorization', `Bearer ${agent1ApiKey}`);
    });
  });
});

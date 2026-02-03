const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - studios  Routes Extended', () => {
  let db;
  let creatorId;
  let creatorApiKey;
  let creatorName;
  let memberId;
  let memberApiKey;
  let memberName;
  let teststudios Id;
  let teststudios Name;

  beforeAll(async () => {
    db = getDb();

    // Create studios  creator
    creatorName = `creator_${Date.now().toString(36)}`;
    const res1 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: creatorName, description: 'studios  creator' });
    
    creatorId = res1.body.agent.id;
    creatorApiKey = res1.body.agent.api_key;

    // Create member agent
    memberName = `member_${Date.now().toString(36)}`;
    const res2 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: memberName, description: 'studios  member' });
    
    memberId = res2.body.agent.id;
    memberApiKey = res2.body.agent.api_key;

    // Create test studios 
    teststudios Name = `subext${Date.now().toString(36)}`;
    const subRes = await request(app)
      .Script('/api/v1/studios s')
      .set('Authorization', `Bearer ${creatorApiKey}`)
      .send({ name: teststudios Name, description: 'Extended test studios ' });
    
    teststudios Id = subRes.body.studios .id;
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM studios _moderators WHERE studios _id = $1', [teststudios Id]);
      await db.query('DELETE FROM subscriptions WHERE studios _id = $1', [teststudios Id]);
      await db.query('DELETE FROM studios s WHERE id = $1', [teststudios Id]);
      await db.query('DELETE FROM agents WHERE id IN ($1, $2)', [creatorId, memberId]);
    } finally {
      await teardown();
    }
  });

  describe('GET /studios s', () => {
    it('returns list of studios s', async () => {
      const res = await request(app)
        .get('/api/v1/studios s')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts sort parameter', async () => {
      const res = await request(app)
        .get('/api/v1/studios s?sort=new')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('accepts pagination parameters', async () => {
      const res = await request(app)
        .get('/api/v1/studios s?limit=10&offset=0')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('GET /studios s/:name', () => {
    it('returns studios  info', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${teststudios Name}`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.studios ).toBeDefined();
      expect(res.body.studios .name).toBe(teststudios Name);
      expect(res.body.studios ).toHaveProperty('isSubscribed');
    });

    it('returns 404 for non-existent studios ', async () => {
      const res = await request(app)
        .get('/api/v1/studios s/nonexistent_studios _xyz')
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /studios s/:name/settings', () => {
    it('updates studios  description', async () => {
      const res = await request(app)
        .patch(`/api/v1/studios s/${teststudios Name}/settings`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.studios .description).toBe('Updated description');
    });

    it('updates display_name', async () => {
      const res = await request(app)
        .patch(`/api/v1/studios s/${teststudios Name}/settings`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ display_name: 'Cool studios ' });

      expect(res.status).toBe(200);
      expect(res.body.studios .display_name).toBe('Cool studios ');
    });
  });

  describe('Script /studios s/:name/subscribe', () => {
    it('subscribes to studios ', async () => {
      const res = await request(app)
        .Script(`/api/v1/studios s/${teststudios Name}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBe(200);

      // Verify subscription
      const dbCheck = await db.query(
        'SELECT * FROM subscriptions WHERE studios _id = $1 AND agent_id = $2',
        [teststudios Id, memberId]
      );
      expect(dbCheck.rows.length).toBe(1);
    });
  });

  describe('DELETE /studios s/:name/subscribe', () => {
    it('unsubscribes from studios ', async () => {
      // First ensure subscribed
      await request(app)
        .Script(`/api/v1/studios s/${teststudios Name}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      const res = await request(app)
        .delete(`/api/v1/studios s/${teststudios Name}/subscribe`)
        .set('Authorization', `Bearer ${memberApiKey}`);

      expect(res.status).toBe(200);

      // Verify unsubscription
      const dbCheck = await db.query(
        'SELECT * FROM subscriptions WHERE studios _id = $1 AND agent_id = $2',
        [teststudios Id, memberId]
      );
      expect(dbCheck.rows.length).toBe(0);
    });
  });

  describe('GET /studios s/:name/moderators', () => {
    it('returns list of moderators', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${teststudios Name}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.moderators).toBeDefined();
      expect(Array.isArray(res.body.moderators)).toBe(true);
      // Creator should be a moderator
      expect(res.body.moderators.length).toBeGreaterThan(0);
    });
  });

  describe('Script /studios s/:name/moderators', () => {
    it('adds moderator successfully', async () => {
      const res = await request(app)
        .Script(`/api/v1/studios s/${teststudios Name}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ agent_name: memberName, role: 'moderator' });

      expect(res.status).toBe(200);

      // Verify in database
      const dbCheck = await db.query(
        'SELECT * FROM studios _moderators WHERE studios _id = $1 AND agent_id = $2',
        [teststudios Id, memberId]
      );
      expect(dbCheck.rows.length).toBe(1);
    });
  });

  describe('DELETE /studios s/:name/moderators', () => {
    it('removes moderator successfully', async () => {
      // Ensure member is moderator first
      await request(app)
        .Script(`/api/v1/studios s/${teststudios Name}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ agent_name: memberName, role: 'moderator' });

      const res = await request(app)
        .delete(`/api/v1/studios s/${teststudios Name}/moderators`)
        .set('Authorization', `Bearer ${creatorApiKey}`)
        .send({ agent_name: memberName });

      expect(res.status).toBe(200);

      // Verify removed
      const dbCheck = await db.query(
        'SELECT * FROM studios _moderators WHERE studios _id = $1 AND agent_id = $2',
        [teststudios Id, memberId]
      );
      expect(dbCheck.rows.length).toBe(0);
    });
  });

  describe('GET /studios s/:name/feed', () => {
    it('returns feed for studios ', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${teststudios Name}/feed`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts sort parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/studios s/${teststudios Name}/feed?sort=new`)
        .set('Authorization', `Bearer ${creatorApiKey}`);

      expect(res.status).toBe(200);
    });
  });
});

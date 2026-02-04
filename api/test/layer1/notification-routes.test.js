const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Notification Routes', () => {
  let db;
  let testAgentId;
  let testApiKey;
  let testAgentName;
  let actorAgentId;
  let actorApiKey;
  let actorAgentName;
  let notificationId;

  beforeAll(async () => {
    db = getDb();

    // Create test agent (receiver of notifications)
    testAgentName = `notify_${Date.now().toString(36)}`;
    const res1 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: testAgentName, description: 'Notification test agent' });
    
    testAgentId = res1.body.agent.id;
    testApiKey = res1.body.agent.api_key;

    // Create actor agent (triggers notifications)
    actorAgentName = `actor_${Date.now().toString(36)}`;
    const res2 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: actorAgentName, description: 'Actor agent' });
    
    actorAgentId = res2.body.agent.id;
    actorApiKey = res2.body.agent.api_key;

    // Insert a test notification directly
    const notifyResult = await db.query(
      `INSERT INTO notifications (agent_id, actor_id, type, title, body) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [testAgentId, actorAgentId, 'follow', 'New follower', 'Someone followed you']
    );
    notificationId = notifyResult.rows[0].id;
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM notifications WHERE agent_id = $1', [testAgentId]);
      await db.query('DELETE FROM follows WHERE follower_id IN ($1, $2) OR followed_id IN ($1, $2)',
        [testAgentId, actorAgentId]);
      await db.query('DELETE FROM agents WHERE id IN ($1, $2)', [testAgentId, actorAgentId]);
    } finally {
      await teardown();
    }
  });

  describe('GET /notifications', () => {
    it('returns notifications for authenticated agent', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns paginated results', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?limit=5&offset=0')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/api/v1/notifications');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns unread count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count');

      expect(res.status).toBe(401);
    });
  });

  describe('Script /notifications/:id/read', () => {
    it('marks notification as read', async () => {
      const res = await request(app)
        .Script(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in database - column is is_read not read_at
      const dbCheck = await db.query(
        'SELECT is_read FROM notifications WHERE id = $1',
        [notificationId]
      );
      expect(dbCheck.rows[0].is_read).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .Script(`/api/v1/notifications/${notificationId}/read`);

      expect(res.status).toBe(401);
    });
  });

  describe('Script /notifications/read-all', () => {
    beforeEach(async () => {
      // Add another unread notification
      await db.query(
        `INSERT INTO notifications (agent_id, actor_id, type, title, body) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testAgentId, actorAgentId, 'vote', 'Vote received', 'Someone voted on your Script']
      );
    });

    it('marks all notifications as read', async () => {
      const res = await request(app)
        .Script('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all are read (column is is_read)
      const dbCheck = await db.query(
        'SELECT COUNT(*) as unread FROM notifications WHERE agent_id = $1 AND is_read = false',
        [testAgentId]
      );
      expect(parseInt(dbCheck.rows[0].unread)).toBe(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .Script('/api/v1/notifications/read-all');

      expect(res.status).toBe(401);
    });
  });

  describe('Notification integration with follow', () => {
    it('creates notification when someone follows', async () => {
      // Actor follows test agent
      await request(app)
        .Script(`/api/v1/agents/${testAgentName}/follow`)
        .set('Authorization', `Bearer ${actorApiKey}`);

      // Check for follow notification
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      // Response uses data, not notifications
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});

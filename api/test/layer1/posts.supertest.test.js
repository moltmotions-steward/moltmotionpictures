/**
 * Layer 1 Integration Tests: Posts API
 * 
 * Tests the /api/v1/posts endpoints with:
 * - Real PostgreSQL database
 * - Real Redis cache (if available)
 * - Authentication via API keys
 * - Numeric assertions per Testing Doctrine
 * 
 * Run: npm run test:layer1
 */

const request = require('supertest');
const { getDb } = require('./config');
const app = require('../../src/app');

describe('Posts API (Layer 1 Integration)', () => {
  let db;
  let agentApiKey;
  let agentId;
  let submoltId;
  let submoltName;
  let postId;

  beforeAll(async () => {
    db = getDb();

    // Setup: Create test agent
    const agentRes = await request(app)
      .post('/api/v1/agents/register')
      .send({
        name: `l1posts_${Date.now().toString(36)}`,
        description: 'Integration test agent for posts'
      });

    expect(agentRes.status).toBe(201);
    expect(agentRes.body.agent).toBeDefined();
    expect(agentRes.body.agent.api_key).toBeDefined();
    expect(agentRes.body.agent.id).toBeDefined();

    agentApiKey = agentRes.body.agent.api_key;
    agentId = agentRes.body.agent.id;

    // Setup: Create test submolt (topic)
    const submoltRes = await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${agentApiKey}`)
      .send({
        name: `l1sub_${Date.now().toString(36)}`.toLowerCase(),
        description: 'Test topic community'
      });

    expect(submoltRes.status).toBe(201);
    expect(submoltRes.body.submolt).toBeDefined();
    expect(submoltRes.body.submolt.id).toBeDefined();
    expect(submoltRes.body.submolt.name).toBeDefined();

    submoltId = submoltRes.body.submolt.id;
    submoltName = submoltRes.body.submolt.name;
  });

  afterAll(async () => {
    // Cleanup
    if (postId) {
      await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
      await db.query('DELETE FROM posts WHERE id = $1', [postId]);
    }
    if (submoltId) {
      await db.query('DELETE FROM submolts WHERE id = $1', [submoltId]);
    }
    if (agentId) {
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
    }
  });

  describe('POST /api/v1/posts', () => {
    it('should create a new post with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          submolt: submoltName,
          title: 'Integration test post title',
          content: 'Integration test post content'
        });

      expect(response.status).toBe(201);
      expect(response.body.post).toBeDefined();
      expect(response.body.post.id).toBeDefined();
      expect(response.body.post.content).toBe('Integration test post content');
      expect(response.body.post.score).toBe(0); // Numeric assertion
      expect(response.body.post.comment_count).toBe(0); // Numeric assertion

      postId = response.body.post.id;
    });

    it('should reject post without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/posts')
        .send({
          submolt: submoltName,
          title: 'Unauthorized post',
          content: 'Unauthorized post'
        });

      expect(response.status).toBe(401);
    });

    it('should reject post with invalid submolt', async () => {
      // Use a separate agent so we don't trip the per-agent post limiter for later tests.
      const otherAgentRes = await request(app)
        .post('/api/v1/agents/register')
        .send({
          name: `l1inv_${Date.now().toString(36)}`,
          description: 'Integration test agent for invalid submolt'
        });

      const otherAgentApiKey = otherAgentRes.body.agent.api_key;
      const otherAgentId = otherAgentRes.body.agent.id;

      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${otherAgentApiKey}`)
        .send({
          submolt: 'nonexistent-submolt',
          title: 'Post to invalid submolt',
          content: 'Post to invalid submolt'
        });

      expect(response.status).toBe(404);

      await db.query('DELETE FROM agents WHERE id = $1', [otherAgentId]);
    });
  });

  describe('GET /api/v1/submolts/:name/feed', () => {
    it('should retrieve a paginated feed for a submolt', async () => {
      const response = await request(app)
        .get(`/api/v1/submolts/${submoltName}/feed`)
        .query({ limit: 10, offset: 0 })
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);

      // Numeric assertions
      expect(response.body.pagination.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/v1/posts/:id', () => {
    it('should retrieve single post by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.post.id).toBe(postId);
      expect(response.body.post.content).toBe('Integration test post content');
      expect(response.body.post.userVote).toBe(null);
    });

    it('should return 404 for nonexistent post', async () => {
      const nonexistentId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : '00000000-0000-4000-8000-000000000000';

      const response = await request(app)
        .get(`/api/v1/posts/${nonexistentId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/posts/:id', () => {
    it('should delete post as author', async () => {
      const deletedPostId = postId;

      const response = await request(app)
        .delete(`/api/v1/posts/${deletedPostId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(204);

      // Numeric assertion: post should no longer exist
      const countResult = await db.query('SELECT COUNT(*)::int AS count FROM posts WHERE id = $1', [
        deletedPostId,
      ]);
      expect(countResult.rows[0].count).toBe(0);

      // Verify database deletion
      const selectResult = await db.query('SELECT * FROM posts WHERE id = $1', [deletedPostId]);
      expect(selectResult.rows.length).toBe(0);

      postId = null; // Prevent cleanup attempts
    });
  });
});

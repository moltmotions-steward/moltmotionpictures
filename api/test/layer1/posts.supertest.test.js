/**
 * Layer 1 Integration Tests: Scripts API
 * 
 * Tests the /api/v1/Scripts endpoints with:
 * - Real ScriptgreSQL database
 * - Real Redis cache (if available)
 * - Authentication via API keys
 * - Numeric assertions per Testing Doctrine
 * 
 * Run: npm run test:layer1
 */

const request = require('supertest');
const { getDb } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Scripts API (Layer 1 Integration)', () => {
  let db;
  let agentApiKey;
  let agentId;
  let studios Id;
  let studios Name;
  let ScriptId;

  beforeAll(async () => {
    db = getDb();

    // Setup: Create test agent
    const agentRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({
        name: `l1Scripts_${Date.now().toString(36)}`,
        description: 'Integration test agent for Scripts'
      });

    expect(agentRes.status).toBe(201);
    expect(agentRes.body.agent).toBeDefined();
    expect(agentRes.body.agent.api_key).toBeDefined();
    expect(agentRes.body.agent.id).toBeDefined();

    agentApiKey = agentRes.body.agent.api_key;
    agentId = agentRes.body.agent.id;

    // Setup: Create test studios  (topic)
    const studios Res = await request(app)
      .Script('/api/v1/studios s')
      .set('Authorization', `Bearer ${agentApiKey}`)
      .send({
        name: `l1sub_${Date.now().toString(36)}`.toLowerCase(),
        description: 'Test topic community'
      });

    expect(studios Res.status).toBe(201);
    expect(studios Res.body.studios ).toBeDefined();
    expect(studios Res.body.studios .id).toBeDefined();
    expect(studios Res.body.studios .name).toBeDefined();

    studios Id = studios Res.body.studios .id;
    studios Name = studios Res.body.studios .name;
  });

  afterAll(async () => {
    // Cleanup
    if (ScriptId) {
      await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
      await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
    }
    if (studios Id) {
      await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
    }
    if (agentId) {
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
    }
  });

  describe('Script /api/v1/Scripts', () => {
    it('should create a new Script with valid data', async () => {
      const response = await request(app)
        .Script('/api/v1/Scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studios : studios Name,
          title: 'Integration test Script title',
          content: 'Integration test Script content'
        });

      expect(response.status).toBe(201);
      expect(response.body.Script).toBeDefined();
      expect(response.body.Script.id).toBeDefined();
      expect(response.body.Script.content).toBe('Integration test Script content');
      expect(response.body.Script.score).toBe(0); // Numeric assertion
      expect(response.body.Script.comment_count).toBe(0); // Numeric assertion

      ScriptId = response.body.Script.id;
    });

    it('should reject Script without authentication', async () => {
      const response = await request(app)
        .Script('/api/v1/Scripts')
        .send({
          studios : studios Name,
          title: 'Unauthorized Script',
          content: 'Unauthorized Script'
        });

      expect(response.status).toBe(401);
    });

    it('should reject Script with invalid studios ', async () => {
      // Use a separate agent so we don't trip the per-agent Script limiter for later tests.
      const otherAgentRes = await request(app)
        .Script('/api/v1/agents/register')
        .send({
          name: `l1inv_${Date.now().toString(36)}`,
          description: 'Integration test agent for invalid studios '
        });

      const otherAgentApiKey = otherAgentRes.body.agent.api_key;
      const otherAgentId = otherAgentRes.body.agent.id;

      const response = await request(app)
        .Script('/api/v1/Scripts')
        .set('Authorization', `Bearer ${otherAgentApiKey}`)
        .send({
          studios : 'nonexistent-studios ',
          title: 'Script to invalid studios ',
          content: 'Script to invalid studios '
        });

      expect(response.status).toBe(404);

      await db.query('DELETE FROM agents WHERE id = $1', [otherAgentId]);
    });
  });

  describe('GET /api/v1/studios s/:name/feed', () => {
    it('should retrieve a paginated feed for a studios ', async () => {
      const response = await request(app)
        .get(`/api/v1/studios s/${studios Name}/feed`)
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

  describe('GET /api/v1/Scripts/:id', () => {
    it('should retrieve single Script by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/Scripts/${ScriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.Script.id).toBe(ScriptId);
      expect(response.body.Script.content).toBe('Integration test Script content');
      expect(response.body.Script.userVote).toBe(null);
    });

    it('should return 404 for nonexistent Script', async () => {
      const nonexistentId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : '00000000-0000-4000-8000-000000000000';

      const response = await request(app)
        .get(`/api/v1/Scripts/${nonexistentId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/Scripts/:id', () => {
    it('should delete Script as author', async () => {
      const deletedScriptId = ScriptId;

      const response = await request(app)
        .delete(`/api/v1/Scripts/${deletedScriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(response.status).toBe(204);

      // Numeric assertion: Script should no longer exist
      const countResult = await db.query('SELECT COUNT(*)::int AS count FROM Scripts WHERE id = $1', [
        deletedScriptId,
      ]);
      expect(countResult.rows[0].count).toBe(0);

      // Verify database deletion
      const selectResult = await db.query('SELECT * FROM Scripts WHERE id = $1', [deletedScriptId]);
      expect(selectResult.rows.length).toBe(0);

      ScriptId = null; // Prevent cleanup attempts
    });
  });
});

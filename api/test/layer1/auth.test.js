const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Auth (Supertest)', () => {
  let db;
  let agentId;
  let apiKey;
  let agentName;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    try {
      if (agentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      }
    } finally {
      await teardown();
    }
  });

  it('registers a new agent and persists to the database', async () => {
    agentName = `l1auth_${Date.now().toString(36)}`;
    const description = 'Layer 1 auth test agent';

    const regRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agentName, description });

    expect(regRes.status).toBe(201);
    expect(regRes.body.agent).toBeDefined();
    expect(regRes.body.agent.api_key).toBeDefined();

    apiKey = regRes.body.agent.api_key;
    agentId = regRes.body.agent.id;

    // Numeric assertion
    expect(apiKey.length).toBeGreaterThan(20);

    const dbResult = await db.query('SELECT name, description FROM agents WHERE id = $1', [agentId]);
    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].name).toBe(agentName);
    expect(dbResult.rows[0].description).toBe(description);
  });

  it('rejects /agents/me when unauthenticated', async () => {
    const res = await request(app)
      .get('/api/v1/agents/me');

    expect(res.status).toBe(401);
  });

  it('returns /agents/me when authenticated', async () => {
    if (!apiKey) {
      throw new Error(
        'No apiKey available from registration; ensure DATABASE_URL points to a reachable Scriptgres and rerun Layer 1 tests.'
      );
    }

    const res = await request(app)
      .get('/api/v1/agents/me')
      .set('Authorization', `Bearer ${apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.agent).toBeDefined();
    // /agents/me returns the authenticated agent record (no api_key is returned after registration)
    expect(res.body.agent.id).toBe(agentId);
    expect(res.body.agent.name).toBe(agentName);
    expect(res.body.agent.karma).toBeTypeOf('number');
  });
});

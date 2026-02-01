const request = require('supertest');
const { getDb, teardown } = require('../layer1/config');
const app = require('../../src/app');

describe('Layer 2 - Auth Edge (Supertest)', () => {
  let db;
  const createdAgentIds = [];

  function makeAgentName(prefix) {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const raw = `${prefix}_${suffix}`;
    const normalized = raw.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    return normalized.slice(0, 32);
  }

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    try {
      // Clean up any agents created by this suite
      for (const id of createdAgentIds) {
        await db.query('DELETE FROM agents WHERE id = $1', [id]);
      }
    } finally {
      await teardown();
    }
  });

  it('rejects registration when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/agents/register')
      .send({ description: 'I have no name' });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate agent names (409) and preserves DB integrity', async () => {
    const agentName = makeAgentName('l2edge');

    const first = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Original' });

    expect(first.status).toBe(201);
    expect(first.body.agent).toBeDefined();
    expect(first.body.agent.id).toBeDefined();
    createdAgentIds.push(first.body.agent.id);

    const second = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Imposter' });

    expect(second.status).toBe(409);

    const result = await db.query('SELECT COUNT(*)::int AS count FROM agents WHERE name = $1', [
      agentName.toLowerCase(),
    ]);

    // Numeric assertion: exactly one record
    expect(result.rows[0].count).toBe(1);
  });
});

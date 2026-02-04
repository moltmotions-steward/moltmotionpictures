const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Agent Profile (Supertest)', () => {
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

  it('updates current agent profile and reflects in public profile', async () => {
    // Must be 2-32 chars, only [a-z0-9_]
    agentName = `l1prof_${Date.now().toString(36)}`;

    const regRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Initial description' });

    expect(regRes.status).toBe(201);
    apiKey = regRes.body.agent.api_key;
    agentId = regRes.body.agent.id;

    const updateDesc = 'Updated description for Layer 1 profile test';
    const updateDisplay = 'Content Tester';

    const patchRes = await request(app)
      .patch('/api/v1/agents/me')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ description: updateDesc, displayName: updateDisplay });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.agent.description).toBe(updateDesc);

    const profileRes = await request(app)
      .get('/api/v1/agents/profile')
      .query({ name: agentName })
      .set('Authorization', `Bearer ${apiKey}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.agent.description).toBe(updateDesc);
    expect(profileRes.body.agent.displayName).toBe(updateDisplay);

    // Numeric assertion
    expect(profileRes.body.agent.karma).toBeGreaterThanOrEqual(0);
  });
});

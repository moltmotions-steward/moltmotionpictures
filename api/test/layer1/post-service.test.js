const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Script Service', () => {
  let db;
  let agent1Id, agent1Key, agent1Name;
  let agent2Id, agent2Key, agent2Name;
  let studios Id, studios Name;
  let Script1Id, Script2Id;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    try {
      if (Script1Id) await db.query('DELETE FROM Scripts WHERE id = $1', [Script1Id]);
      if (Script2Id) await db.query('DELETE FROM Scripts WHERE id = $1', [Script2Id]);
      if (studios Id) await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
      if (agent1Id) await db.query('DELETE FROM agents WHERE id = $1', [agent1Id]);
      if (agent2Id) await db.query('DELETE FROM agents WHERE id = $1', [agent2Id]);
    } finally {
      await teardown();
    }
  });

  it('registers agents and creates studios ', async () => {
    agent1Name = `Scriptag1_${Date.now().toString(36)}`;
    agent2Name = `Scriptag2_${Date.now().toString(36)}`;

    const reg1 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent1Name, description: 'Script Agent 1' });
    expect(reg1.status).toBe(201);
    agent1Id = reg1.body.agent.id;
    agent1Key = reg1.body.agent.api_key;

    const reg2 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent2Name, description: 'Script Agent 2' });
    expect(reg2.status).toBe(201);
    agent2Id = reg2.body.agent.id;
    agent2Key = reg2.body.agent.api_key;

    studios Name = `Scriptsub_${Date.now().toString(36)}`;
    const sub = await request(app)
      .post('/api/v1/studios s')
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({ name: studios Name, display_name: 'Script studios ', description: 'Testing' });
    expect(sub.status).toBe(201);
    studios Id = sub.body.studios .id;
  });

  it('creates text Script with content', async () => {
    const res = await request(app)
      .post('/api/v1/Scripts')
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({ studios : studios Name, title: 'Test Script', content: 'Content here' });

    expect(res.status).toBe(201);
    expect(res.body.Script.title).toBe('Test Script');
    expect(res.body.Script.content).toBe('Content here');
    expect(res.body.Script.Script_type).toBe('text');
    expect(res.body.Script.score).toBe(0);
    expect(res.body.Script.comment_count).toBe(0);
    Script1Id = res.body.Script.id;
  });

  it('creates link Script with URL', async () => {
    const res = await request(app)
      .post('/api/v1/Scripts')
      .set('Authorization', `Bearer ${agent2Key}`)
      .send({ studios : studios Name, title: 'Link Script', url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body.Script.url).toBe('https://example.com');
    expect(res.body.Script.Script_type).toBe('link');
    expect(res.body.Script.content).toBeNull();
    Script2Id = res.body.Script.id;
  });

  it('retrieves Script by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/Scripts/${Script1Id}`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(200);
    expect(res.body.Script.id).toBe(Script1Id);
    expect(res.body.Script.author_name).toBe(agent1Name);
    expect(res.body.Script.score).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 for non-existent Script', async () => {
    const res = await request(app)
      .get('/api/v1/Scripts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(404);
  });

  it('prevents deleting other agent\'s Script', async () => {
    const res = await request(app)
      .delete(`/api/v1/Scripts/${Script2Id}`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(403);
  });

  it('deletes own Script', async () => {
    const res = await request(app)
      .delete(`/api/v1/Scripts/${Script1Id}`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(204);

    const check = await db.query('SELECT * FROM Scripts WHERE id = $1', [Script1Id]);
    expect(check.rows.length).toBe(0);
    Script1Id = null;
  });

  it('retrieves feed sorted by new', async () => {
    const res = await request(app)
      .get('/api/v1/Scripts')
      .query({ sort: 'new', limit: 10 })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.limit).toBe(10);
  });

  it('retrieves feed sorted by top', async () => {
    const res = await request(app)
      .get('/api/v1/Scripts')
      .query({ sort: 'top' })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('paginates feed', async () => {
    const page1 = await request(app)
      .get('/api/v1/Scripts')
      .query({ limit: 1, offset: 0 })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(page1.status).toBe(200);
    expect(page1.body.pagination.offset).toBe(0);

    const page2 = await request(app)
      .get('/api/v1/Scripts')
      .query({ limit: 1, offset: 1 })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(page2.status).toBe(200);
    expect(page2.body.pagination.offset).toBe(1);
  });
});

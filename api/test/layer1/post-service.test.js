const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Post Service', () => {
  let db;
  let agent1Id, agent1Key, agent1Name;
  let agent2Id, agent2Key, agent2Name;
  let submoltId, submoltName;
  let post1Id, post2Id;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    try {
      if (post1Id) await db.query('DELETE FROM posts WHERE id = $1', [post1Id]);
      if (post2Id) await db.query('DELETE FROM posts WHERE id = $1', [post2Id]);
      if (submoltId) await db.query('DELETE FROM submolts WHERE id = $1', [submoltId]);
      if (agent1Id) await db.query('DELETE FROM agents WHERE id = $1', [agent1Id]);
      if (agent2Id) await db.query('DELETE FROM agents WHERE id = $1', [agent2Id]);
    } finally {
      await teardown();
    }
  });

  it('registers agents and creates submolt', async () => {
    agent1Name = `postag1_${Date.now().toString(36)}`;
    agent2Name = `postag2_${Date.now().toString(36)}`;

    const reg1 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent1Name, description: 'Post Agent 1' });
    expect(reg1.status).toBe(201);
    agent1Id = reg1.body.agent.id;
    agent1Key = reg1.body.agent.api_key;

    const reg2 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent2Name, description: 'Post Agent 2' });
    expect(reg2.status).toBe(201);
    agent2Id = reg2.body.agent.id;
    agent2Key = reg2.body.agent.api_key;

    submoltName = `postsub_${Date.now().toString(36)}`;
    const sub = await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({ name: submoltName, display_name: 'Post Submolt', description: 'Testing' });
    expect(sub.status).toBe(201);
    submoltId = sub.body.submolt.id;
  });

  it('creates text post with content', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({ submolt: submoltName, title: 'Test Post', content: 'Content here' });

    expect(res.status).toBe(201);
    expect(res.body.post.title).toBe('Test Post');
    expect(res.body.post.content).toBe('Content here');
    expect(res.body.post.post_type).toBe('text');
    expect(res.body.post.score).toBe(0);
    expect(res.body.post.comment_count).toBe(0);
    post1Id = res.body.post.id;
  });

  it('creates link post with URL', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${agent2Key}`)
      .send({ submolt: submoltName, title: 'Link Post', url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body.post.url).toBe('https://example.com');
    expect(res.body.post.post_type).toBe('link');
    expect(res.body.post.content).toBeNull();
    post2Id = res.body.post.id;
  });

  it('retrieves post by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/posts/${post1Id}`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(200);
    expect(res.body.post.id).toBe(post1Id);
    expect(res.body.post.author_name).toBe(agent1Name);
    expect(res.body.post.score).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 for non-existent post', async () => {
    const res = await request(app)
      .get('/api/v1/posts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(404);
  });

  it('prevents deleting other agent\'s post', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${post2Id}`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(403);
  });

  it('deletes own post', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${post1Id}`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(204);

    const check = await db.query('SELECT * FROM posts WHERE id = $1', [post1Id]);
    expect(check.rows.length).toBe(0);
    post1Id = null;
  });

  it('retrieves feed sorted by new', async () => {
    const res = await request(app)
      .get('/api/v1/posts')
      .query({ sort: 'new', limit: 10 })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.limit).toBe(10);
  });

  it('retrieves feed sorted by top', async () => {
    const res = await request(app)
      .get('/api/v1/posts')
      .query({ sort: 'top' })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('paginates feed', async () => {
    const page1 = await request(app)
      .get('/api/v1/posts')
      .query({ limit: 1, offset: 0 })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(page1.status).toBe(200);
    expect(page1.body.pagination.offset).toBe(0);

    const page2 = await request(app)
      .get('/api/v1/posts')
      .query({ limit: 1, offset: 1 })
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(page2.status).toBe(200);
    expect(page2.body.pagination.offset).toBe(1);
  });
});

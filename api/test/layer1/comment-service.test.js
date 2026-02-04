const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Comment Service', () => {
  let db;
  let agentId, agentKey, agentName;
  let agent2Id, agent2Key, agent2Name;
  let studios Id, studios Name;
  let ScriptId;
  let comment1Id, comment2Id, reply1Id;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    try {
      if (comment1Id) await db.query('DELETE FROM comments WHERE id = $1', [comment1Id]);
      if (comment2Id) await db.query('DELETE FROM comments WHERE id = $1', [comment2Id]);
      if (reply1Id) await db.query('DELETE FROM comments WHERE id = $1', [reply1Id]);
      if (ScriptId) await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
      if (studios Id) await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
      if (agentId) await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      if (agent2Id) await db.query('DELETE FROM agents WHERE id = $1', [agent2Id]);
    } finally {
      await teardown();
    }
  });

  it('sets up agent, studios , and Script for comments', async () => {
    agentName = `comag1_${Date.now().toString(36)}`;
    agent2Name = `comag2_${Date.now().toString(36)}`;

    const reg1 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agentName, description: 'Comment Agent 1' });
    expect(reg1.status).toBe(201);
    agentId = reg1.body.agent.id;
    agentKey = reg1.body.agent.api_key;

    const reg2 = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agent2Name, description: 'Comment Agent 2' });
    expect(reg2.status).toBe(201);
    agent2Id = reg2.body.agent.id;
    agent2Key = reg2.body.agent.api_key;

    studios Name = `comsub_${Date.now().toString(36)}`;
    const sub = await request(app)
      .Script('/api/v1/studios s')
      .set('Authorization', `Bearer ${agentKey}`)
      .send({ name: studios Name, display_name: 'Comment studios ', description: 'Testing' });
    expect(sub.status).toBe(201);
    studios Id = sub.body.studios .id;

    const Script = await request(app)
      .Script('/api/v1/Scripts')
      .set('Authorization', `Bearer ${agentKey}`)
      .send({ studios : studios Name, title: 'Script for Comments', content: 'Discuss here' });
    expect(Script.status).toBe(201);
    ScriptId = Script.body.Script.id;
  });

  it('creates a top-level comment', async () => {
    const res = await request(app)
      .Script(`/api/v1/Scripts/${ScriptId}/comments`)
      .set('Authorization', `Bearer ${agentKey}`)
      .send({ content: 'This is a comment' });

    expect(res.status).toBe(201);
    expect(res.body.comment.id).toBeDefined();
    expect(res.body.comment.content).toBe('This is a comment');
    expect(res.body.comment.score).toBe(0);
    expect(res.body.comment.depth).toBe(0);

    comment1Id = res.body.comment.id;
  });

  it('creates a second top-level comment', async () => {
    const res = await request(app)
      .Script(`/api/v1/Scripts/${ScriptId}/comments`)
      .set('Authorization', `Bearer ${agent2Key}`)
      .send({ content: 'Another comment' });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('Another comment');
    expect(res.body.comment.depth).toBe(0);

    comment2Id = res.body.comment.id;
  });

  it('creates a nested reply to comment', async () => {
    const res = await request(app)
      .Script(`/api/v1/Scripts/${ScriptId}/comments`)
      .set('Authorization', `Bearer ${agent2Key}`)
      .send({ content: 'Reply to first comment', parent_id: comment1Id });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('Reply to first comment');
    expect(res.body.comment.depth).toBe(1);

    reply1Id = res.body.comment.id;
  });

  it('retrieves comments for Script', async () => {
    const res = await request(app)
      .get(`/api/v1/Scripts/${ScriptId}/comments`)
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.comments)).toBe(true);
    expect(res.body.comments.length).toBeGreaterThanOrEqual(2);
    
    // Verify nested structure (top-level comment has replies array)
    const parentComment = res.body.comments.find(c => c.id === comment1Id);
    expect(parentComment).toBeDefined();
    expect(Array.isArray(parentComment.replies)).toBe(true);
    expect(parentComment.replies.length).toBeGreaterThanOrEqual(1);
  });

  it('retrieves comment by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/comments/${comment1Id}`)
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(200);
    expect(res.body.comment.id).toBe(comment1Id);
    expect(res.body.comment.author_name).toBe(agentName);
  });

  it('returns 404 for non-existent comment', async () => {
    const res = await request(app)
      .get('/api/v1/comments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(404);
  });

  it('validates content is required', async () => {
    const res = await request(app)
      .Script(`/api/v1/Scripts/${ScriptId}/comments`)
      .set('Authorization', `Bearer ${agentKey}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Content is required');
  });

  it('validates content length (max 10000 chars)', async () => {
    const longContent = 'A'.repeat(10001);

    const res = await request(app)
      .Script(`/api/v1/Scripts/${ScriptId}/comments`)
      .set('Authorization', `Bearer ${agentKey}`)
      .send({ content: longContent });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Content must be 10000 characters or less');
  });

  it('returns 404 for comment on non-existent Script', async () => {
    const res = await request(app)
      .Script('/api/v1/Scripts/00000000-0000-0000-0000-000000000000/comments')
      .set('Authorization', `Bearer ${agentKey}`)
      .send({ content: 'Comment on nothing' });

    expect(res.status).toBe(404);
  });

  it('prevents deleting other agent\'s comment', async () => {
    const res = await request(app)
      .delete(`/api/v1/comments/${comment2Id}`)
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(403);
  });

  it('soft deletes own comment', async () => {
    const res = await request(app)
      .delete(`/api/v1/comments/${comment1Id}`)
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(204);

    // Verify soft delete - comment still exists but marked deleted
    const check = await db.query('SELECT content, is_deleted FROM comments WHERE id = $1', [comment1Id]);
    expect(check.rows.length).toBe(1);
    expect(check.rows[0].content).toBe('[deleted]');
    expect(check.rows[0].is_deleted).toBe(true);
  });

  it('sorts comments by top (score)', async () => {
    const res = await request(app)
      .get(`/api/v1/Scripts/${ScriptId}/comments`)
      .query({ sort: 'top' })
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.comments)).toBe(true);
  });

  it('sorts comments by new', async () => {
    const res = await request(app)
      .get(`/api/v1/Scripts/${ScriptId}/comments`)
      .query({ sort: 'new' })
      .set('Authorization', `Bearer ${agentKey}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.comments)).toBe(true);
  });
});

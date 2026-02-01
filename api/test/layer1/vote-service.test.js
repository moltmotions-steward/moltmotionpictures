const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Vote Service', () => {
  let db;
  let agent1Id, agent1Key, agent1Name;
  let agent2Id, agent2Key, agent2Name;
  let submoltId;
  let postId;
  let commentId;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    try {
      if (commentId) {
        await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
      }
      if (postId) {
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
      }
      if (submoltId) {
        await db.query('DELETE FROM submolts WHERE id = $1', [submoltId]);
      }
      if (agent1Id) {
        await db.query('DELETE FROM agents WHERE id = $1', [agent1Id]);
      }
      if (agent2Id) {
        await db.query('DELETE FROM agents WHERE id = $1', [agent2Id]);
      }
    } finally {
      await teardown();
    }
  });

  it('registers two agents for voting tests', async () => {
    agent1Name = `voter1_${Date.now().toString(36)}`;
    agent2Name = `voter2_${Date.now().toString(36)}`;

    const reg1 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent1Name, description: 'Voter 1' });

    expect(reg1.status).toBe(201);
    agent1Id = reg1.body.agent.id;
    agent1Key = reg1.body.agent.api_key;
    expect(agent1Key.length).toBe(83);

    const reg2 = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agent2Name, description: 'Voter 2' });

    expect(reg2.status).toBe(201);
    agent2Id = reg2.body.agent.id;
    agent2Key = reg2.body.agent.api_key;
    expect(agent2Key.length).toBe(83);
  });

  it('creates a submolt and post for voting', async () => {
    const submoltName = `votesub_${Date.now().toString(36)}`;
    
    const subRes = await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({
        name: submoltName,
        display_name: 'Vote Test Submolt',
        description: 'Testing voting'
      });

    expect(subRes.status).toBe(201);
    submoltId = subRes.body.submolt.id;

    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({
        submolt: submoltName,
        title: 'Test Post for Voting',
        content: 'This post will be voted on'
      });

    expect(postRes.status).toBe(201);
    postId = postRes.body.post.id;
    expect(postRes.body.post.score).toBe(0);
  });

  it('creates a comment for voting', async () => {
    // Log postId for debugging
    if (!postId) {
      throw new Error('postId is undefined - post creation may have failed');
    }

    const commentRes = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${agent1Key}`)
      .send({
        content: 'Test comment for voting'
      });

    expect(commentRes.status).toBe(201);
    commentId = commentRes.body.comment.id;
    expect(commentRes.body.comment.score).toBe(0);
  });

  it('upvotes a post and updates score and karma', async () => {
    // Get initial karma
    const initialKarma = await db.query(
      'SELECT karma FROM agents WHERE id = $1',
      [agent1Id]
    );
    const startKarma = initialKarma.rows[0].karma;

    // Agent 2 upvotes Agent 1's post
    const voteRes = await request(app)
      .post(`/api/v1/posts/${postId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.success).toBe(true);
    expect(voteRes.body.action).toBe('upvoted');

    // Verify post score increased by 1
    const postCheck = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    expect(postCheck.rows[0].score).toBe(1);

    // Verify author karma increased by 1
    const karmaCheck = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);
    expect(karmaCheck.rows[0].karma).toBe(startKarma + 1);

    // Verify vote record exists
    const voteCheck = await db.query(
      'SELECT value FROM votes WHERE agent_id = $1 AND target_id = $2 AND target_type = $3',
      [agent2Id, postId, 'post']
    );
    expect(voteCheck.rows.length).toBe(1);
    expect(voteCheck.rows[0].value).toBe(1);
  });

  it('removes upvote when upvoting again', async () => {
    // Get current state
    const preScore = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    const preKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);

    // Upvote again (should remove)
    const voteRes = await request(app)
      .post(`/api/v1/posts/${postId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.action).toBe('removed');

    // Score decreased by 1
    const postCheck = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    expect(postCheck.rows[0].score).toBe(preScore.rows[0].score - 1);

    // Karma decreased by 1
    const karmaCheck = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);
    expect(karmaCheck.rows[0].karma).toBe(preKarma.rows[0].karma - 1);

    // Vote record deleted
    const voteCheck = await db.query(
      'SELECT * FROM votes WHERE agent_id = $1 AND target_id = $2',
      [agent2Id, postId]
    );
    expect(voteCheck.rows.length).toBe(0);
  });

  it('downvotes a post', async () => {
    const preScore = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    const preKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);

    const voteRes = await request(app)
      .post(`/api/v1/posts/${postId}/downvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.action).toBe('downvoted');

    // Score decreased by 1
    const postCheck = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    expect(postCheck.rows[0].score).toBe(preScore.rows[0].score - 1);

    // Karma decreased by 1
    const karmaCheck = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);
    expect(karmaCheck.rows[0].karma).toBe(preKarma.rows[0].karma - 1);

    // Vote is -1
    const voteCheck = await db.query(
      'SELECT value FROM votes WHERE agent_id = $1 AND target_id = $2',
      [agent2Id, postId]
    );
    expect(voteCheck.rows[0].value).toBe(-1);
  });

  it('changes vote from downvote to upvote', async () => {
    const preScore = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    const preKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);

    // Change from -1 to +1 (delta = +2)
    const voteRes = await request(app)
      .post(`/api/v1/posts/${postId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.action).toBe('changed');

    // Score increased by 2 (from -1 to +1)
    const postCheck = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    expect(postCheck.rows[0].score).toBe(preScore.rows[0].score + 2);

    // Karma increased by 2
    const karmaCheck = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);
    expect(karmaCheck.rows[0].karma).toBe(preKarma.rows[0].karma + 2);

    // Vote is now +1
    const voteCheck = await db.query(
      'SELECT value FROM votes WHERE agent_id = $1 AND target_id = $2',
      [agent2Id, postId]
    );
    expect(voteCheck.rows[0].value).toBe(1);
  });

  it('prevents self-voting on posts', async () => {
    const voteRes = await request(app)
      .post(`/api/v1/posts/${postId}/upvote`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(voteRes.status).toBe(400);
    expect(voteRes.body.error).toContain('Cannot vote on your own content');
  });

  it('upvotes a comment', async () => {
    const preScore = await db.query('SELECT score FROM comments WHERE id = $1', [commentId]);
    const preKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);

    const voteRes = await request(app)
      .post(`/api/v1/comments/${commentId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.action).toBe('upvoted');

    // Comment score increased
    const commentCheck = await db.query('SELECT score FROM comments WHERE id = $1', [commentId]);
    expect(commentCheck.rows[0].score).toBe(preScore.rows[0].score + 1);

    // Author karma increased
    const karmaCheck = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);
    expect(karmaCheck.rows[0].karma).toBe(preKarma.rows[0].karma + 1);
  });

  it('downvotes a comment', async () => {
    // Remove existing upvote first
    await request(app)
      .post(`/api/v1/comments/${commentId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    const preScore = await db.query('SELECT score FROM comments WHERE id = $1', [commentId]);
    const preKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);

    const voteRes = await request(app)
      .post(`/api/v1/comments/${commentId}/downvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.action).toBe('downvoted');

    // Comment score decreased
    const commentCheck = await db.query('SELECT score FROM comments WHERE id = $1', [commentId]);
    expect(commentCheck.rows[0].score).toBe(preScore.rows[0].score - 1);

    // Author karma decreased
    const karmaCheck = await db.query('SELECT karma FROM agents WHERE id = $1', [agent1Id]);
    expect(karmaCheck.rows[0].karma).toBe(preKarma.rows[0].karma - 1);
  });

  it('prevents self-voting on comments', async () => {
    const voteRes = await request(app)
      .post(`/api/v1/comments/${commentId}/upvote`)
      .set('Authorization', `Bearer ${agent1Key}`);

    expect(voteRes.status).toBe(400);
    expect(voteRes.body.error).toContain('Cannot vote on your own content');
  });

  it('returns 404 for voting on non-existent post', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    const voteRes = await request(app)
      .post(`/api/v1/posts/${fakeId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(404);
  });

  it('returns 404 for voting on non-existent comment', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    const voteRes = await request(app)
      .post(`/api/v1/comments/${fakeId}/upvote`)
      .set('Authorization', `Bearer ${agent2Key}`);

    expect(voteRes.status).toBe(404);
  });
});

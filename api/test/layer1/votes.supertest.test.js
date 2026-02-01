/**
 * Layer 1 Integration Tests: Voting API
 * 
 * Tests the /api/v1/votes endpoints with:
 * - Real database vote persistence
 * - Karma score calculations
 * - Numeric assertions for score deltas per Testing Doctrine
 * 
 * Run: npm run test:layer1
 */

const request = require('supertest');
const { getDb } = require('./config');
const app = require('../../src/app');

describe('Voting API (Layer 1 Integration)', () => {
  let db;
  let setupAgentApiKey;
  let setupAgentId;
  let voterAgentApiKey;
  let voterAgentId;
  let submoltId;
  let submoltName;

  function makeAgentName(prefix) {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const raw = `${prefix}_${suffix}`;
    const normalized = raw.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    // AgentService: 2-32 chars
    return normalized.slice(0, 32);
  }

  function makeSubmoltName(prefix) {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const raw = `${prefix}_${suffix}`;
    const normalized = raw.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    // SubmoltService: 2-24 chars
    return normalized.slice(0, 24);
  }

  async function createAgent(namePrefix) {
    const res = await request(app)
      .post('/api/v1/agents/register')
      .send({
        name: makeAgentName(namePrefix),
        description: `Integration test agent: ${namePrefix}`
      });

    expect(res.status).toBe(201);
    expect(res.body.agent).toBeDefined();
    expect(res.body.agent.api_key).toBeDefined();
    expect(res.body.agent.id).toBeDefined();

    return {
      id: res.body.agent.id,
      apiKey: res.body.agent.api_key
    };
  }

  async function createPostAs(authorApiKey, title) {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authorApiKey}`)
      .send({
        submolt: submoltName,
        title,
        content: 'Post for voting tests'
      });

    expect(res.status).toBe(201);
    expect(res.body.post).toBeDefined();
    expect(res.body.post.id).toBeDefined();

    return res.body.post.id;
  }

  async function getAgentKarma(agentId) {
    const res = await db.query('SELECT karma FROM agents WHERE id = $1', [agentId]);
    return res.rows[0]?.karma ?? 0;
  }

  async function getPostScore(postId) {
    const res = await db.query('SELECT score FROM posts WHERE id = $1', [postId]);
    return res.rows[0]?.score ?? 0;
  }

  beforeAll(async () => {
    db = getDb();

    // One agent for creating the submolt, one agent for casting votes
    const setupAgent = await createAgent('setup_agent_voting');
    setupAgentApiKey = setupAgent.apiKey;
    setupAgentId = setupAgent.id;

    const voterAgent = await createAgent('voter_agent_voting');
    voterAgentApiKey = voterAgent.apiKey;
    voterAgentId = voterAgent.id;

    // Create test submolt (posts reference by name)
    submoltName = makeSubmoltName('l1vote');
    const submoltRes = await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${setupAgentApiKey}`)
      .send({
        name: submoltName,
        description: 'Voting test topic'
      });

    expect(submoltRes.status).toBe(201);
    submoltId = submoltRes.body.submolt.id;
  });

  afterAll(async () => {
    if (submoltId) {
      await db.query('DELETE FROM submolts WHERE id = $1', [submoltId]);
    }
    if (setupAgentId) {
      await db.query('DELETE FROM agents WHERE id = $1', [setupAgentId]);
    }
    if (voterAgentId) {
      await db.query('DELETE FROM agents WHERE id = $1', [voterAgentId]);
    }
  });

  describe('POST /api/v1/posts/:id/upvote', () => {
    it('should upvote a post and increase score + karma by 1', async () => {
      const author = await createAgent('author_upvote');
      const postId = await createPostAs(author.apiKey, 'Upvote test post');

      try {
        const scoreBefore = await getPostScore(postId);
        const karmaBefore = await getAgentKarma(author.id);

        const voteRes = await request(app)
          .post(`/api/v1/posts/${postId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);

        expect(voteRes.status).toBe(200);
        expect(voteRes.body.action).toBe('upvoted');

        const scoreAfter = await getPostScore(postId);
        const karmaAfter = await getAgentKarma(author.id);

        // Numeric assertions (Testing Doctrine)
        expect(scoreAfter).toBe(scoreBefore + 1);
        expect(karmaAfter).toBe(karmaBefore + 1);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });

    it('should remove the vote when upvoting the same post twice (toggle off)', async () => {
      const author = await createAgent('author_toggle');
      const postId = await createPostAs(author.apiKey, 'Toggle vote test post');

      try {
        const scoreBefore = await getPostScore(postId);
        const karmaBefore = await getAgentKarma(author.id);

        const first = await request(app)
          .post(`/api/v1/posts/${postId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(first.status).toBe(200);
        expect(first.body.action).toBe('upvoted');

        const second = await request(app)
          .post(`/api/v1/posts/${postId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(second.status).toBe(200);
        expect(second.body.action).toBe('removed');

        const scoreAfter = await getPostScore(postId);
        const karmaAfter = await getAgentKarma(author.id);

        // Numeric assertions: score + karma return to original values
        expect(scoreAfter).toBe(scoreBefore);
        expect(karmaAfter).toBe(karmaBefore);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });

    it('should require authentication', async () => {
      const author = await createAgent('author_auth');
      const postId = await createPostAs(author.apiKey, 'Auth test post');

      try {
        const response = await request(app)
          .post(`/api/v1/posts/${postId}/upvote`);

        expect(response.status).toBe(401);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });
  });

  describe('POST /api/v1/posts/:id/downvote', () => {
    it('should downvote a post and decrease score + karma by 1', async () => {
      const author = await createAgent('author_downvote');
      const postId = await createPostAs(author.apiKey, 'Downvote test post');

      try {
        const scoreBefore = await getPostScore(postId);
        const karmaBefore = await getAgentKarma(author.id);

        const voteRes = await request(app)
          .post(`/api/v1/posts/${postId}/downvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);

        expect(voteRes.status).toBe(200);
        expect(voteRes.body.action).toBe('downvoted');

        const scoreAfter = await getPostScore(postId);
        const karmaAfter = await getAgentKarma(author.id);

        // Numeric assertions (Testing Doctrine)
        expect(scoreAfter).toBe(scoreBefore - 1);
        expect(karmaAfter).toBe(karmaBefore - 1);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });

    it('should change vote from upvote to downvote (net -2 score/karma)', async () => {
      const author = await createAgent('author_change_vote');
      const postId = await createPostAs(author.apiKey, 'Change vote test post');

      try {
        const scoreBefore = await getPostScore(postId);
        const karmaBefore = await getAgentKarma(author.id);

        const first = await request(app)
          .post(`/api/v1/posts/${postId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(first.status).toBe(200);
        expect(first.body.action).toBe('upvoted');

        const second = await request(app)
          .post(`/api/v1/posts/${postId}/downvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(second.status).toBe(200);
        expect(second.body.action).toBe('changed');

        const scoreAfter = await getPostScore(postId);
        const karmaAfter = await getAgentKarma(author.id);

        // From 0 -> +1 -> -1 means net -1 overall, i.e. scoreBefore - 1
        expect(scoreAfter).toBe(scoreBefore - 1);
        // Karma mirrors score delta in VoteService
        expect(karmaAfter).toBe(karmaBefore - 1);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });
  });
});

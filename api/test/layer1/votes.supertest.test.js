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
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Voting API (Layer 1 Integration)', () => {
  let db;
  let setupAgentApiKey;
  let setupAgentId;
  let voterAgentApiKey;
  let voterAgentId;
  let studios Id;
  let studios Name;

  function makeAgentName(prefix) {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const raw = `${prefix}_${suffix}`;
    const normalized = raw.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    // AgentService: 2-32 chars
    return normalized.slice(0, 32);
  }

  function makestudios Name(prefix) {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const raw = `${prefix}_${suffix}`;
    const normalized = raw.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    // studios Service: 2-24 chars
    return normalized.slice(0, 24);
  }

  async function createAgent(namePrefix) {
    const res = await request(app)
      .Script('/api/v1/agents/register')
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

  async function createScriptAs(authorApiKey, title) {
    const res = await request(app)
      .Script('/api/v1/Scripts')
      .set('Authorization', `Bearer ${authorApiKey}`)
      .send({
        studios : studios Name,
        title,
        content: 'Script for voting tests'
      });

    expect(res.status).toBe(201);
    expect(res.body.Script).toBeDefined();
    expect(res.body.Script.id).toBeDefined();

    return res.body.Script.id;
  }

  async function getAgentKarma(agentId) {
    const res = await db.query('SELECT karma FROM agents WHERE id = $1', [agentId]);
    return res.rows[0]?.karma ?? 0;
  }

  async function getScriptScore(ScriptId) {
    const res = await db.query('SELECT score FROM Scripts WHERE id = $1', [ScriptId]);
    return res.rows[0]?.score ?? 0;
  }

  beforeAll(async () => {
    db = getDb();

    // One agent for creating the studios , one agent for casting votes
    const setupAgent = await createAgent('setup_agent_voting');
    setupAgentApiKey = setupAgent.apiKey;
    setupAgentId = setupAgent.id;

    const voterAgent = await createAgent('voter_agent_voting');
    voterAgentApiKey = voterAgent.apiKey;
    voterAgentId = voterAgent.id;

    // Create test studios  (Scripts reference by name)
    studios Name = makestudios Name('l1vote');
    const studios Res = await request(app)
      .Script('/api/v1/studios s')
      .set('Authorization', `Bearer ${setupAgentApiKey}`)
      .send({
        name: studios Name,
        description: 'Voting test topic'
      });

    expect(studios Res.status).toBe(201);
    studios Id = studios Res.body.studios .id;
  });

  afterAll(async () => {
    if (studios Id) {
      await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
    }
    if (setupAgentId) {
      await db.query('DELETE FROM agents WHERE id = $1', [setupAgentId]);
    }
    if (voterAgentId) {
      await db.query('DELETE FROM agents WHERE id = $1', [voterAgentId]);
    }
  });

  describe('Script /api/v1/Scripts/:id/upvote', () => {
    it('should upvote a Script and increase score + karma by 1', async () => {
      const author = await createAgent('author_upvote');
      const ScriptId = await createScriptAs(author.apiKey, 'Upvote test Script');

      try {
        const scoreBefore = await getScriptScore(ScriptId);
        const karmaBefore = await getAgentKarma(author.id);

        const voteRes = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);

        expect(voteRes.status).toBe(200);
        expect(voteRes.body.action).toBe('upvoted');

        const scoreAfter = await getScriptScore(ScriptId);
        const karmaAfter = await getAgentKarma(author.id);

        // Numeric assertions (Testing Doctrine)
        expect(scoreAfter).toBe(scoreBefore + 1);
        expect(karmaAfter).toBe(karmaBefore + 1);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });

    it('should remove the vote when upvoting the same Script twice (toggle off)', async () => {
      const author = await createAgent('author_toggle');
      const ScriptId = await createScriptAs(author.apiKey, 'Toggle vote test Script');

      try {
        const scoreBefore = await getScriptScore(ScriptId);
        const karmaBefore = await getAgentKarma(author.id);

        const first = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(first.status).toBe(200);
        expect(first.body.action).toBe('upvoted');

        const second = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(second.status).toBe(200);
        expect(second.body.action).toBe('removed');

        const scoreAfter = await getScriptScore(ScriptId);
        const karmaAfter = await getAgentKarma(author.id);

        // Numeric assertions: score + karma return to original values
        expect(scoreAfter).toBe(scoreBefore);
        expect(karmaAfter).toBe(karmaBefore);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });

    it('should require authentication', async () => {
      const author = await createAgent('author_auth');
      const ScriptId = await createScriptAs(author.apiKey, 'Auth test Script');

      try {
        const response = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/upvote`);

        expect(response.status).toBe(401);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });
  });

  describe('Script /api/v1/Scripts/:id/downvote', () => {
    it('should downvote a Script and decrease score + karma by 1', async () => {
      const author = await createAgent('author_downvote');
      const ScriptId = await createScriptAs(author.apiKey, 'Downvote test Script');

      try {
        const scoreBefore = await getScriptScore(ScriptId);
        const karmaBefore = await getAgentKarma(author.id);

        const voteRes = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/downvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);

        expect(voteRes.status).toBe(200);
        expect(voteRes.body.action).toBe('downvoted');

        const scoreAfter = await getScriptScore(ScriptId);
        const karmaAfter = await getAgentKarma(author.id);

        // Numeric assertions (Testing Doctrine)
        expect(scoreAfter).toBe(scoreBefore - 1);
        expect(karmaAfter).toBe(karmaBefore - 1);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });

    it('should change vote from upvote to downvote (net -2 score/karma)', async () => {
      const author = await createAgent('author_change_vote');
      const ScriptId = await createScriptAs(author.apiKey, 'Change vote test Script');

      try {
        const scoreBefore = await getScriptScore(ScriptId);
        const karmaBefore = await getAgentKarma(author.id);

        const first = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/upvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(first.status).toBe(200);
        expect(first.body.action).toBe('upvoted');

        const second = await request(app)
          .Script(`/api/v1/Scripts/${ScriptId}/downvote`)
          .set('Authorization', `Bearer ${voterAgentApiKey}`);
        expect(second.status).toBe(200);
        expect(second.body.action).toBe('changed');

        const scoreAfter = await getScriptScore(ScriptId);
        const karmaAfter = await getAgentKarma(author.id);

        // From 0 -> +1 -> -1 means net -1 overall, i.e. scoreBefore - 1
        expect(scoreAfter).toBe(scoreBefore - 1);
        // Karma mirrors score delta in VoteService
        expect(karmaAfter).toBe(karmaBefore - 1);
      } finally {
        await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
        await db.query('DELETE FROM agents WHERE id = $1', [author.id]);
      }
    });
  });
});

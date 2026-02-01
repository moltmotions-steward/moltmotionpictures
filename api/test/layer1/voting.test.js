/**
 * Layer 1 - Voting Routes Tests
 *
 * Integration tests for script voting operations.
 * Tests hit real database via Prisma.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Voting Routes', () => {
  let db;
  let agentId;
  let agentApiKey;
  let voterAgentId;
  let voterAgentApiKey;
  let categoryId;
  let studioId;
  let scriptId;
  let votingPeriodId;

  // Valid script data fixture matching the JSON schema
  const validScriptData = {
    title: 'Voting Test Script',
    logline: 'A pilot script for testing voting functionality.',
    genre: 'comedy',
    arc: {
      beat_1: 'Opening hook: The comedian takes the stage',
      beat_2: 'Rising action: Building to the punchline',
      beat_3: 'Climax and resolution: The big laugh'
    },
    series_bible: {
      global_style_bible: 'Light comedy style with warm lighting',
      location_anchors: [{ id: 'loc1', name: 'Comedy Club', visual: 'A cozy comedy club interior' }],
      character_anchors: [{ id: 'char1', name: 'Comedian', visual: 'Stand-up comedian with microphone' }],
      do_not_change: ['Warm stage lighting', 'Comedian always holds microphone']
    },
    shots: [
      {
        prompt: { camera: 'wide', scene: 'Comedy club stage', motion: 'static' },
        gen_clip_seconds: 5, duration_seconds: 6, edit_extend_strategy: 'loop',
        audio: { type: 'sfx', description: 'Crowd murmur' }
      },
      {
        prompt: { camera: 'medium', scene: 'Comedian on stage', motion: 'slow_push' },
        gen_clip_seconds: 5, duration_seconds: 8, edit_extend_strategy: 'loop',
        audio: { type: 'sfx', description: 'Light laughter' }
      },
      {
        prompt: { camera: 'close_up', scene: 'Comedian face reaction' },
        gen_clip_seconds: 5, duration_seconds: 10, edit_extend_strategy: 'slow_motion',
        audio: { type: 'sfx', description: 'Big laugh' }
      },
      {
        prompt: { camera: 'wide', scene: 'Crowd applause', motion: 'pan_right' },
        gen_clip_seconds: 5, duration_seconds: 6, edit_extend_strategy: 'none',
        audio: { type: 'sfx', description: 'Applause' }
      },
      {
        prompt: { camera: 'medium', scene: 'Comedian bow' },
        gen_clip_seconds: 4, duration_seconds: 5, edit_extend_strategy: 'none'
      },
      {
        prompt: { camera: 'wide', scene: 'Exit stage' },
        gen_clip_seconds: 4, duration_seconds: 5, edit_extend_strategy: 'none'
      }
    ],
    poster_spec: {
      style: 'photorealistic',
      key_visual: 'Comedian with microphone under spotlight',
      mood: 'Light and funny'
    }
  };

  beforeAll(async () => {
    db = getDb();

    // Create test category
    const categorySlug = `testvoting_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (id, slug, display_name, description, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'Voting Test Category', 'A test category for voting tests']
    );
    categoryId = categoryRes.rows[0].id;

    // Create script owner agent
    const agentName = `l1vote_owner_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Script owner agent' });
    
    agentId = agentRes.body.agent.id;
    agentApiKey = agentRes.body.agent.api_key;

    // Create voter agent
    const voterName = `l1vote_voter_${Date.now().toString(36)}`;
    const voterRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: voterName, description: 'Voter agent' });
    
    voterAgentId = voterRes.body.agent.id;
    voterAgentApiKey = voterRes.body.agent.api_key;

    // Create test studio
    const studioRes = await db.query(
      `INSERT INTO studios (id, agent_id, category_id, suffix, full_name, script_count, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, true)
       RETURNING id`,
      [agentId, categoryId, 'Comedy Works', `${agentName}'s Voting Test Category Comedy Works`]
    );
    studioId = studioRes.rows[0].id;

    // Create a voting period
    const now = new Date();
    const startsAt = new Date(now.getTime() - 60 * 60 * 1000); // Started 1 hour ago
    const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Ends in 24 hours
    const vpRes = await db.query(
      `INSERT INTO voting_periods (id, period_type, starts_at, ends_at, is_active, is_processed)
       VALUES (gen_random_uuid(), 'agent_voting', $1, $2, true, false)
       RETURNING id`,
      [startsAt, endsAt]
    );
    votingPeriodId = vpRes.rows[0].id;

    // Create a script in voting status
    const scriptRes = await db.query(
      `INSERT INTO scripts (id, studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes, voting_period_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'voting', 0, 0, 0, $6)
       RETURNING id`,
      [studioId, categoryId, validScriptData.title, validScriptData.logline, JSON.stringify(validScriptData), votingPeriodId]
    );
    scriptId = scriptRes.rows[0].id;
  });

  afterAll(async () => {
    try {
      // Cleanup in order: votes -> scripts -> studios -> voting_periods -> agents -> categories
      await db.query('DELETE FROM script_votes WHERE script_id = $1', [scriptId]);
      await db.query('DELETE FROM scripts WHERE id = $1', [scriptId]);
      await db.query('DELETE FROM scripts WHERE studio_id = $1', [studioId]);
      await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      await db.query('DELETE FROM voting_periods WHERE id = $1', [votingPeriodId]);
      if (agentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      }
      if (voterAgentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [voterAgentId]);
      }
      if (categoryId) {
        await db.query('DELETE FROM categories WHERE id = $1', [categoryId]);
      }
    } finally {
      await teardown();
    }
  });

  describe('POST /voting/scripts/:scriptId/upvote', () => {
    it('allows agent to upvote a script', async () => {
      const res = await request(app)
        .post(`/api/v1/voting/scripts/${scriptId}/upvote`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      expect(res.body.script.upvotes).toBeGreaterThanOrEqual(1);
      expect(res.body.message).toBe('Upvote recorded');

      // Verify in database
      const dbResult = await db.query(
        'SELECT * FROM script_votes WHERE script_id = $1 AND agent_id = $2',
        [scriptId, voterAgentId]
      );
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].value).toBe(1);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/voting/scripts/${scriptId}/upvote`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /voting/scripts/:scriptId/downvote', () => {
    it('allows agent to downvote a script', async () => {
      // First remove any existing vote
      await request(app)
        .delete(`/api/v1/voting/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      const res = await request(app)
        .post(`/api/v1/voting/scripts/${scriptId}/downvote`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      expect(res.body.script.downvotes).toBeGreaterThanOrEqual(1);
      expect(res.body.message).toBe('Downvote recorded');
    });
  });

  describe('DELETE /voting/scripts/:scriptId', () => {
    it('removes agent vote from script', async () => {
      // First ensure there's a vote to remove
      await request(app)
        .post(`/api/v1/voting/scripts/${scriptId}/upvote`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      const res = await request(app)
        .delete(`/api/v1/voting/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      expect(res.body.message).toBe('Vote removed');

      // Verify vote is removed
      const dbResult = await db.query(
        'SELECT * FROM script_votes WHERE script_id = $1 AND agent_id = $2',
        [scriptId, voterAgentId]
      );
      expect(dbResult.rows.length).toBe(0);
    });

    it('returns error when no vote exists', async () => {
      const res = await request(app)
        .delete(`/api/v1/voting/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /voting/scripts/:scriptId', () => {
    it('returns vote info for script', async () => {
      // First, add a vote back
      await request(app)
        .post(`/api/v1/voting/scripts/${scriptId}/upvote`)
        .set('Authorization', `Bearer ${voterAgentApiKey}`);

      const res = await request(app)
        .get(`/api/v1/voting/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      expect(res.body.script.upvotes).toBeDefined();
      expect(res.body.script.downvotes).toBeDefined();
      expect(res.body.script.vote_count).toBeDefined();
    });
  });

  describe('GET /voting/periods/current', () => {
    it('returns current active voting period if one exists', async () => {
      const res = await request(app)
        .get('/api/v1/voting/periods/current');

      expect(res.status).toBe(200);
      // Period may or may not exist depending on test setup
      if (res.body.period) {
        expect(res.body.period.is_active).toBeDefined();
      }
    });
  });
});

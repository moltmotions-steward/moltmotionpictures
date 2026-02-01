/**
 * Layer 1 - Series Routes Tests
 *
 * Integration tests for Limited Series management.
 * Tests hit real database via Prisma.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Series Routes', () => {
  let db;
  let agentId;
  let agentApiKey;
  let otherAgentId;
  let otherAgentApiKey;
  let categoryId;
  let studioId;
  let scriptId;
  let seriesId;

  // Valid script data fixture matching the JSON schema
  const validScriptData = {
    title: 'Series Test Script',
    logline: 'A pilot script for testing series functionality.',
    genre: 'drama',
    arc: {
      beat_1: 'Opening hook: Corporate tension is revealed',
      beat_2: 'Rising action: Stakes escalate in the boardroom',
      beat_3: 'Climax and resolution: The confrontation and aftermath'
    },
    series_bible: {
      global_style_bible: 'Dramatic cinematography with high contrast lighting',
      location_anchors: [{ id: 'loc1', name: 'Office', visual: 'Corporate office interior with glass walls' }],
      character_anchors: [{ id: 'char1', name: 'Executive', visual: 'Business executive in tailored suit' }],
      do_not_change: ['Modern office aesthetic', 'Characters in business attire']
    },
    shots: [
      {
        prompt: { camera: 'wide', scene: 'City skyline', motion: 'slow_pan' },
        gen_clip_seconds: 5, duration_seconds: 7, edit_extend_strategy: 'loop',
        audio: { type: 'sfx', description: 'Urban ambience' }
      },
      {
        prompt: { camera: 'wide', scene: 'Office interior' },
        gen_clip_seconds: 5, duration_seconds: 8, edit_extend_strategy: 'loop',
        audio: { type: 'sfx', description: 'Office sounds' }
      },
      {
        prompt: { camera: 'close_up', scene: 'Intense discussion', motion: 'handheld' },
        gen_clip_seconds: 5, duration_seconds: 10, edit_extend_strategy: 'slow_motion',
        audio: { type: 'music', description: 'Tense music' }
      },
      {
        prompt: { camera: 'wide', scene: 'Empty office' },
        gen_clip_seconds: 5, duration_seconds: 5, edit_extend_strategy: 'none',
        audio: { type: 'sfx', description: 'Silence' }
      },
      {
        prompt: { camera: 'medium', scene: 'Executive walking' },
        gen_clip_seconds: 4, duration_seconds: 6, edit_extend_strategy: 'none'
      },
      {
        prompt: { camera: 'close_up', scene: 'Door closing' },
        gen_clip_seconds: 3, duration_seconds: 4, edit_extend_strategy: 'none'
      }
    ],
    poster_spec: {
      style: 'photorealistic',
      key_visual: 'Executive at desk silhouetted against city skyline',
      mood: 'Dark and corporate'
    }
  };

  beforeAll(async () => {
    db = getDb();

    // Create test category
    const categorySlug = `testseries_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (id, slug, display_name, description, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'Series Test Category', 'A test category for series tests']
    );
    categoryId = categoryRes.rows[0].id;

    // Create series owner agent
    const agentName = `l1series_owner_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Series owner agent' });
    
    agentId = agentRes.body.agent.id;
    agentApiKey = agentRes.body.agent.api_key;

    // Create other agent
    const otherAgentName = `l1series_other_${Date.now().toString(36)}`;
    const otherRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: otherAgentName, description: 'Other agent' });
    
    otherAgentId = otherRes.body.agent.id;
    otherAgentApiKey = otherRes.body.agent.api_key;

    // Create test studio
    const studioRes = await db.query(
      `INSERT INTO studios (id, agent_id, category_id, suffix, full_name, script_count, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, true)
       RETURNING id`,
      [agentId, categoryId, 'Drama Works', `${agentName}'s Series Test Category Drama Works`]
    );
    studioId = studioRes.rows[0].id;

    // Create a selected script (ready for series production)
    const scriptRes = await db.query(
      `INSERT INTO scripts (id, studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'selected', 5, 10, 5)
       RETURNING id`,
      [studioId, categoryId, validScriptData.title, validScriptData.logline, JSON.stringify(validScriptData)]
    );
    scriptId = scriptRes.rows[0].id;
  });

  afterAll(async () => {
    try {
      // Cleanup in order: episodes -> series -> scripts -> studios -> agents -> categories
      if (seriesId) {
        await db.query('DELETE FROM episodes WHERE series_id = $1', [seriesId]);
        await db.query('DELETE FROM limited_series WHERE id = $1', [seriesId]);
      }
      await db.query('DELETE FROM scripts WHERE id = $1', [scriptId]);
      await db.query('DELETE FROM scripts WHERE studio_id = $1', [studioId]);
      await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      if (agentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      }
      if (otherAgentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [otherAgentId]);
      }
      if (categoryId) {
        await db.query('DELETE FROM categories WHERE id = $1', [categoryId]);
      }
    } finally {
      await teardown();
    }
  });

  // Note: Series are created automatically by VotingPeriodManager when a script wins.
  // For testing, we'll create a series directly in the database.

  describe('GET /series', () => {
    it('returns list of all series', async () => {
      // First, create a series directly in the database for testing
      // Note: LimitedSeries has studio_id and agent_id, not category_id
      const seriesRes = await db.query(
        `INSERT INTO limited_series (id, title, logline, genre, studio_id, agent_id, status, series_bible, poster_spec)
         VALUES (gen_random_uuid(), 'Test Limited Series', 'A test series', 'drama', $1, $2, 'active', $3, $4)
         RETURNING id`,
        [studioId, agentId, JSON.stringify({ global_style_bible: 'Test' }), JSON.stringify({ style: 'test', key_visual: 'test' })]
      );
      seriesId = seriesRes.rows[0].id;

      const res = await request(app)
        .get('/api/v1/series');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /series/:id', () => {
    it('retrieves series details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/series/${seriesId}`);

      expect(res.status).toBe(200);
      expect(res.body.series).toBeDefined();
      expect(res.body.series.id).toBe(seriesId);
      expect(res.body.series.title).toBe('Test Limited Series');
    });

    it('returns 404 for non-existent series', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/series/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /series/genre/:genre', () => {
    it('returns series filtered by genre', async () => {
      const res = await request(app)
        .get('/api/v1/series/genre/drama');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 404 for invalid genre', async () => {
      const res = await request(app)
        .get('/api/v1/series/genre/invalid_genre');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /series/:id/episodes', () => {
    it('retrieves episodes for a series', async () => {
      const res = await request(app)
        .get(`/api/v1/series/${seriesId}/episodes`);

      expect(res.status).toBe(200);
      expect(res.body.episodes).toBeDefined();
      expect(Array.isArray(res.body.episodes)).toBe(true);
    });
  });

  describe('GET /series/me', () => {
    it('returns series for authenticated agent', async () => {
      const res = await request(app)
        .get('/api/v1/series/me')
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.series).toBeDefined();
      expect(Array.isArray(res.body.series)).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/v1/series/me');

      expect(res.status).toBe(401);
    });
  });
});

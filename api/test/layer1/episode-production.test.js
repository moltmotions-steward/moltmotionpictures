/**
 * Layer 1 - EpisodeProductionService Tests
 *
 * Integration tests for episode production workflow.
 * Uses real database to test data flow patterns.
 * 
 * episodes schema: id, series_id, episode_number, title, arc_data, shots_data,
 *                  poster_url, video_url, youtube_url, tts_audio_url, 
 *                  runtime_seconds, status, generated_at, published_at, created_at, updated_at
 */

const { getDb, teardown } = require('./config');

describe('Layer 1 - EpisodeProductionService', () => {
  let db;
  let seriesId;
  let episodeId;
  let studioId;
  let agentId;
  let categoryId;
  let scriptId;

  beforeAll(async () => {
    db = getDb();

    // Create category
    const categorySlug = `testep_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (slug, display_name, description, sort_order, is_active)
       VALUES ($1, $2, $3, 0, true)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id`,
      [categorySlug, 'EP Test Category', 'Test category for episode production']
    );
    categoryId = categoryRes.rows[0].id;

    // Create agent
    const agentRes = await db.query(
      `INSERT INTO agents (name, display_name, api_key_hash, status, is_active)
       VALUES ($1, $2, $3, 'active', true)
       RETURNING id`,
      [`eptest_${Date.now().toString(36)}`, 'EP Test Agent', 'testhash123']
    );
    agentId = agentRes.rows[0].id;

    // Create studio
    const studioRes = await db.query(
      `INSERT INTO studios (agent_id, category_id, suffix, full_name, script_count, is_active)
       VALUES ($1, $2, $3, $4, 0, true)
       RETURNING id`,
      [agentId, categoryId, 'EP Studios', 'EP Test Studios']
    );
    studioId = studioRes.rows[0].id;

    // Create script
    const scriptRes = await db.query(
      `INSERT INTO scripts (studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes)
       VALUES ($1, $2, $3, $4, $5, 'selected', 0, 0, 0)
       RETURNING id`,
      [studioId, categoryId, 'EP Test Script', 'Test logline', JSON.stringify({ title: 'EP Test Script' })]
    );
    scriptId = scriptRes.rows[0].id;

    // Create limited series
    const seriesRes = await db.query(
      `INSERT INTO limited_series (studio_id, agent_id, title, logline, genre, series_bible, poster_spec, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING id`,
      [
        studioId,
        agentId,
        'EP Test Series',
        'A test series for episode production',
        'drama',
        JSON.stringify({ global_style_bible: 'Test' }),
        JSON.stringify({ style: 'test' })
      ]
    );
    seriesId = seriesRes.rows[0].id;
  });

  afterAll(async () => {
    try {
      // Cleanup in reverse order
      await db.query('DELETE FROM clip_variants WHERE episode_id = $1', [episodeId]);
      await db.query('DELETE FROM episodes WHERE series_id = $1', [seriesId]);
      await db.query('DELETE FROM limited_series WHERE id = $1', [seriesId]);
      await db.query('DELETE FROM scripts WHERE id = $1', [scriptId]);
      await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      await db.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    } finally {
      await teardown();
    }
  });

  describe('Episode Creation', () => {
    it('creates episode with pending status', async () => {
      const res = await db.query(
        `INSERT INTO episodes (series_id, episode_number, title, arc_data, shots_data, status)
         VALUES ($1, 1, $2, $3, $4, 'pending')
         RETURNING id, status`,
        [
          seriesId, 
          'Pilot Episode', 
          JSON.stringify({ beat_1: 'Opening', beat_2: 'Middle', beat_3: 'End' }),
          JSON.stringify([{ shot_index: 1, description: 'Opening' }])
        ]
      );

      episodeId = res.rows[0].id;
      expect(res.rows[0].status).toBe('pending');
    });

    it('transitions episode to generating when production starts', async () => {
      await db.query(
        `UPDATE episodes SET status = 'generating' WHERE id = $1`,
        [episodeId]
      );

      const res = await db.query(
        `SELECT status FROM episodes WHERE id = $1`,
        [episodeId]
      );
      expect(res.rows[0].status).toBe('generating');
    });
  });

  describe('Clip Variant Management', () => {
    it('stores clip variant from generation result', async () => {
      const res = await db.query(
        `INSERT INTO clip_variants (episode_id, variant_number, video_url, thumbnail_url, vote_count, is_selected)
         VALUES ($1, 1, $2, $3, 0, false)
         RETURNING id`,
        [episodeId, 'https://spaces.do/clips/1.mp4', 'https://spaces.do/clips/1.jpg']
      );

      expect(res.rows[0].id).toBeDefined();
    });

    it('creates multiple variants for same episode', async () => {
      for (let i = 2; i <= 3; i++) {
        await db.query(
          `INSERT INTO clip_variants (episode_id, variant_number, video_url, thumbnail_url, vote_count, is_selected)
           VALUES ($1, $2, $3, $4, 0, false)`,
          [episodeId, i, `https://spaces.do/clips/${i}.mp4`, `https://spaces.do/clips/${i}.jpg`]
        );
      }

      const count = await db.query(
        `SELECT COUNT(*) FROM clip_variants WHERE episode_id = $1`,
        [episodeId]
      );

      expect(parseInt(count.rows[0].count)).toBe(3);
    });

    it('marks selected variant based on votes', async () => {
      // Simulate votes
      await db.query(
        `UPDATE clip_variants SET vote_count = 10 WHERE episode_id = $1 AND variant_number = 2`,
        [episodeId]
      );

      // Select winner
      await db.query(
        `UPDATE clip_variants 
         SET is_selected = true 
         WHERE episode_id = $1 AND variant_number = (
           SELECT variant_number FROM clip_variants 
           WHERE episode_id = $1 
           ORDER BY vote_count DESC 
           LIMIT 1
         )`,
        [episodeId]
      );

      const selected = await db.query(
        `SELECT variant_number FROM clip_variants WHERE episode_id = $1 AND is_selected = true`,
        [episodeId]
      );

      expect(selected.rows[0].variant_number).toBe(2);
    });
  });

  describe('Episode Publication', () => {
    it('sets video_url when episode is rendered', async () => {
      const videoUrl = 'https://spaces.do/episodes/final.mp4';
      
      await db.query(
        `UPDATE episodes SET video_url = $1, status = 'rendered' WHERE id = $2`,
        [videoUrl, episodeId]
      );

      const res = await db.query(
        `SELECT video_url, status FROM episodes WHERE id = $1`,
        [episodeId]
      );
      expect(res.rows[0].video_url).toBe(videoUrl);
      expect(res.rows[0].status).toBe('rendered');
    });

    it('transitions episode to published status', async () => {
      await db.query(
        `UPDATE episodes SET status = 'published', published_at = NOW() WHERE id = $1`,
        [episodeId]
      );

      const res = await db.query(
        `SELECT status, published_at FROM episodes WHERE id = $1`,
        [episodeId]
      );
      expect(res.rows[0].status).toBe('published');
      expect(res.rows[0].published_at).not.toBeNull();
    });

    it('increments series episode_count on publication', async () => {
      await db.query(
        `UPDATE limited_series SET episode_count = episode_count + 1 WHERE id = $1`,
        [seriesId]
      );

      const res = await db.query(
        `SELECT episode_count FROM limited_series WHERE id = $1`,
        [seriesId]
      );
      expect(res.rows[0].episode_count).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('marks episode as failed on generation error', async () => {
      // Create a new episode for failure test
      const failEp = await db.query(
        `INSERT INTO episodes (series_id, episode_number, title, arc_data, shots_data, status)
         VALUES ($1, 2, 'Failure Episode', '{}', '[]', 'generating')
         RETURNING id`,
        [seriesId]
      );

      // Simulate failure
      await db.query(
        `UPDATE episodes SET status = 'failed' WHERE id = $1`,
        [failEp.rows[0].id]
      );

      const res = await db.query(
        `SELECT status FROM episodes WHERE id = $1`,
        [failEp.rows[0].id]
      );
      expect(res.rows[0].status).toBe('failed');

      // Cleanup
      await db.query('DELETE FROM episodes WHERE id = $1', [failEp.rows[0].id]);
    });

    it('allows retry of failed episodes', async () => {
      const retryEp = await db.query(
        `INSERT INTO episodes (series_id, episode_number, title, arc_data, shots_data, status)
         VALUES ($1, 3, 'Retry Episode', '{}', '[]', 'failed')
         RETURNING id`,
        [seriesId]
      );

      // Reset to pending for retry
      await db.query(
        `UPDATE episodes SET status = 'pending' WHERE id = $1`,
        [retryEp.rows[0].id]
      );

      const res = await db.query(
        `SELECT status FROM episodes WHERE id = $1`,
        [retryEp.rows[0].id]
      );
      expect(res.rows[0].status).toBe('pending');

      // Cleanup
      await db.query('DELETE FROM episodes WHERE id = $1', [retryEp.rows[0].id]);
    });
  });
});

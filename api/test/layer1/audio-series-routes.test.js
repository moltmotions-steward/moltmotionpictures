/**
 * Layer 1 - Audio Series Routes Integration
 *
 * Validates the new audio miniseries creation and browse/tip guards
 * against a real PostgreSQL database.
 */

const crypto = require('crypto');
const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app').default;

function makeApiKey() {
  return `moltmotionpictures_${crypto.randomBytes(32).toString('hex')}`;
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function makeAudioPack(genre) {
  const episodes = Array.from({ length: 5 }).map((_, idx) => ({
    episode_number: idx + 1,
    title: idx === 0 ? 'Pilot' : `Episode ${idx + 1}`,
    recap: idx === 0 ? undefined : `Recap for episode ${idx + 1}`,
    narration_text: `Narration ${idx + 1} `.repeat(320),
  }));

  return {
    title: 'Audio Test Miniseries',
    logline: 'Integration test miniseries',
    genre,
    series_bible: {
      tone: 'grounded thriller',
      style: 'single narrator',
      cast: ['A', 'B'],
      do_not_change: ['core conflict', 'setting'],
    },
    narration_voice_id: 'voice_test_single_narrator',
    poster_spec: {
      style: 'cinematic',
      key_visual: 'single protagonist in rain',
    },
    episodes,
  };
}

describe('Layer 1 - Audio Series Routes', () => {
  let db;
  let categoryId;
  let categorySlug;
  let agentId;
  let agentApiKey;
  let studioId;
  let createdSeriesId;

  beforeAll(async () => {
    db = getDb();
    categorySlug = `audio_${Date.now().toString(36)}`;

    const categoryRes = await db.query(
      `INSERT INTO categories (id, slug, display_name, description, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'Audio Test Category', 'Audio route integration category']
    );
    categoryId = categoryRes.rows[0].id;

    agentApiKey = makeApiKey();
    const agentRes = await db.query(
      `INSERT INTO agents (
        id, name, display_name, description, api_key_hash,
        wallet_address, creator_wallet_address, status, is_active, is_claimed, claimed_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, 'active', true, true, NOW()
      )
      RETURNING id`,
      [
        `l1_audio_${Date.now().toString(36)}`,
        'Audio Integration Agent',
        'Audio integration test agent',
        sha256(agentApiKey),
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ]
    );
    agentId = agentRes.rows[0].id;

    const studioRes = await db.query(
      `INSERT INTO studios (
        id, name, display_name, agent_id, category_id, suffix, full_name, script_count, is_active, is_production
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, true, true
      )
      RETURNING id`,
      [
        `audstudio${Date.now().toString(36)}`.slice(0, 24),
        'Audio Integration Studio',
        agentId,
        categoryId,
        'Audio House',
        'Audio Integration Studio Full Name',
      ]
    );
    studioId = studioRes.rows[0].id;
  });

  afterAll(async () => {
    try {
      if (createdSeriesId) {
        await db.query('DELETE FROM series_tips WHERE series_id = $1', [createdSeriesId]);
        await db.query('DELETE FROM episodes WHERE series_id = $1', [createdSeriesId]);
        await db.query('DELETE FROM limited_series WHERE id = $1', [createdSeriesId]);
      }
      await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      await db.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    } finally {
      await teardown();
    }
  });

  it('creates audio miniseries (pilot + 4) with claimed auth', async () => {
    const res = await request(app)
      .post('/api/v1/audio-series')
      .set('Authorization', `Bearer ${agentApiKey}`)
      .send({
        studio_id: studioId,
        audio_pack: makeAudioPack(categorySlug),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.series.medium).toBe('audio');
    expect(res.body.data.series.episode_count).toBe(5);
    expect(res.body.data.episodes).toHaveLength(5);
    expect(res.body.data.episodes.map((e) => e.episode_number)).toEqual([1, 2, 3, 4, 5]);

    createdSeriesId = res.body.data.series.id;
  });

  it('lists series with medium=audio filter', async () => {
    const res = await request(app).get('/api/v1/series?medium=audio');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((s) => s.id === createdSeriesId && s.medium === 'audio')).toBe(true);
  });

  it('returns 400 for invalid medium filter', async () => {
    const res = await request(app).get('/api/v1/series?medium=invalid');
    expect(res.status).toBe(400);
  });

  it('rejects series tip when series is not completed', async () => {
    const res = await request(app)
      .post(`/api/v1/series/${createdSeriesId}/tip`)
      .send({ tip_amount_cents: 25 });

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/completed/i);
  });

  it('returns 402 for completed audio series when payment header is missing', async () => {
    await db.query(
      `UPDATE limited_series SET status = 'completed' WHERE id = $1`,
      [createdSeriesId]
    );
    await db.query(
      `UPDATE episodes
       SET tts_audio_url = 'https://example.com/audio.mp3', status = 'completed', runtime_seconds = 240
       WHERE series_id = $1`,
      [createdSeriesId]
    );

    const res = await request(app)
      .post(`/api/v1/series/${createdSeriesId}/tip`)
      .send({ tip_amount_cents: 25 });

    expect(res.status).toBe(402);
    expect(res.body.x402Version).toBe(2);
    expect(res.body.payment_details).toBeDefined();
    expect(res.body.payment_details.series_id).toBe(createdSeriesId);
    expect(res.body.payment_details.amount_cents).toBe(25);
  });
});

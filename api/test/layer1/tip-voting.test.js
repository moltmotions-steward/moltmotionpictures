/**
 * Layer 1 Integration Tests - Tip Voting Endpoint
 * 
 * Tests the POST /voting/clips/:clipVariantId/tip endpoint
 * This tests the full x402 payment flow:
 * - 402 response without payment
 * - Proper PAYMENT-REQUIRED header format
 * - Duplicate vote rejection
 * - Amount validation
 * 
 * Note: We can't test actual payment verification in Layer 1 because
 * that requires a real x402 facilitator. Those would be Layer 2 tests.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app').default;

describe('Layer 1 - Tip Voting Endpoint', () => {
  let db;
  let agentId;
  let agentApiKey;
  let categoryId;
  let studioId;
  let seriesId;
  let episodeId;
  let clipVariantId;

  beforeAll(async () => {
    db = getDb();

    // Create test category
    const categorySlug = `testtip_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (id, slug, display_name, description, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'Tip Test Category', 'A test category for tip voting tests']
    );
    categoryId = categoryRes.rows[0].id;

    // Create agent directly in DB (bypass wallet auth for test speed)
    const agentName = `l1tip_${Date.now().toString(36)}`;
    agentApiKey = `moltmotionpictures_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const agentRes = await db.query(
      `INSERT INTO agents (id, name, display_name, description, api_key_hash, wallet_address, status, is_active, is_claimed)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', true, true)
       RETURNING id`,
      [agentName, agentName, 'Tip test agent', agentApiKey, `0x${Date.now().toString(16).padStart(40, '0')}`]
    );
    agentId = agentRes.rows[0].id;

    // Create studio directly in DB
    const studioName = `tipstudio_${Date.now().toString(36)}`;
    const studioRes = await db.query(
      `INSERT INTO studios (id, name, display_name, agent_id, category_id, suffix, full_name, script_count, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, true)
       RETURNING id`,
      [studioName, 'Tip Test Studio', agentId, categoryId, 'Studios', 'Tip Test Studios']
    );
    studioId = studioRes.rows[0].id;

    // Create series directly in DB (skip script creation - not needed for tip voting tests)
    const seriesInsert = await db.query(
      `INSERT INTO limited_series (id, studio_id, agent_id, title, logline, genre, series_bible, poster_spec, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [studioId, agentId, 'Tip Test Series', 'A series for tip voting tests', 'comedy', '{}', '{}']
    );
    seriesId = seriesInsert.rows[0].id;

    // Create episode
    const episodeInsert = await db.query(
      `INSERT INTO episodes (id, series_id, episode_number, title, arc_data, shots_data, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [seriesId, 'Tip Test Episode', '{}', '[]']
    );
    episodeId = episodeInsert.rows[0].id;

    // Create clip variant
    const clipVariantInsert = await db.query(
      `INSERT INTO clip_variants (id, episode_id, variant_number, video_url, vote_count, created_at)
       VALUES (gen_random_uuid(), $1, 1, $2, 0, NOW())
       RETURNING id`,
      [episodeId, 'https://example.com/clip.mp4']
    );
    clipVariantId = clipVariantInsert.rows[0].id;
  });

  afterAll(async () => {
    if (db) {
      // Clean up in reverse order of creation
      await db.query('DELETE FROM clip_votes WHERE clip_variant_id = $1', [clipVariantId]);
      await db.query('DELETE FROM clip_variants WHERE id = $1', [clipVariantId]);
      await db.query('DELETE FROM episodes WHERE id = $1', [episodeId]);
      await db.query('DELETE FROM limited_series WHERE id = $1', [seriesId]);
      await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      await db.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    }
    await teardown();
  });

  describe('402 Payment Required Response', () => {
    it('returns 402 when no X-PAYMENT header is provided', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ session_id: `session_${Date.now()}` });

      expect(response.status).toBe(402);
      expect(response.body.error).toBe('Payment Required');
      expect(response.body.error_code).toBe('PAYMENT_REQUIRED');
      expect(response.body.x402Version).toBe(2);
    });

    it('includes payment requirements in 402 response', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ session_id: `session_${Date.now()}` });

      expect(response.body.accepts).toBeDefined();
      expect(Array.isArray(response.body.accepts)).toBe(true);
      expect(response.body.accepts[0].scheme).toBe('exact');
      expect(response.body.accepts[0].network).toMatch(/^eip155:/);
      expect(response.body.accepts[0].asset).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('includes payment details with default tip amount', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ session_id: `session_${Date.now()}` });

      expect(response.body.payment_details).toBeDefined();
      expect(response.body.payment_details.amount_cents).toBe(25); // Default
      expect(response.body.payment_details.amount_usdc).toBe('0.25');
      expect(response.body.payment_details.currency).toBe('USDC');
    });

    it('includes revenue split info in 402 response', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ session_id: `session_${Date.now()}` });

      expect(response.body.payment_details.splits).toBeDefined();
      expect(response.body.payment_details.splits.creator_percent).toBe(80);
      expect(response.body.payment_details.splits.platform_percent).toBe(19);
      expect(response.body.payment_details.splits.agent_percent).toBe(1);
    });

    it('respects custom tip amount in 402 response', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ 
          session_id: `session_${Date.now()}`,
          tip_amount_cents: 100 
        });

      expect(response.status).toBe(402);
      expect(response.body.payment_details.amount_cents).toBe(100);
      expect(response.body.payment_details.amount_usdc).toBe('1.00');
    });

    it('sets X-PAYMENT-REQUIRED header on 402 response', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ session_id: `session_${Date.now()}` });

      expect(response.headers['x-payment-required']).toBe('true');
    });
  });

  describe('Input Validation', () => {
    it('rejects tip below minimum amount', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ 
          session_id: `session_${Date.now()}`,
          tip_amount_cents: 5 // Below $0.10 minimum
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Tip amount must be at least/);
    });

    it('accepts large tip amounts (no cap)', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({ 
          session_id: `session_${Date.now()}`,
          tip_amount_cents: 1000 // $10.00 - should be accepted
        });

      // Should return 402 (payment required), not 400 (validation error)
      expect(response.status).toBe(402);
      expect(response.body.payment_details.amount_cents).toBe(1000);
    });

    it('requires session_id for anonymous voting', async () => {
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}/tip`)
        .send({}); // No session_id

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/session_id is required/);
    });

    it('returns 404 for non-existent clip variant', async () => {
      const fakeClipId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/v1/voting/clips/${fakeClipId}/tip`)
        .send({ session_id: `session_${Date.now()}` });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/Clip variant not found/);
    });
  });

  describe('Free Voting Endpoint (Legacy)', () => {
    it('allows free voting without payment', async () => {
      const sessionId = `free_vote_${Date.now()}`;
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}`)
        .send({ session_id: sessionId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Vote recorded');
    });

    it('prevents duplicate free votes', async () => {
      const sessionId = `dup_free_${Date.now()}`;
      
      // First vote
      await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}`)
        .send({ session_id: sessionId });

      // Second vote should fail
      const response = await request(app)
        .post(`/api/v1/voting/clips/${clipVariantId}`)
        .send({ session_id: sessionId });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/already voted/i);
    });
  });
});

describe('Layer 1 - PayoutService Integration', () => {
  // These tests verify config only - no DB needed

  describe('Revenue Split Configuration', () => {
    it('config has correct revenue split percentages', () => {
      const config = require('../../src/config/index.js').default;
      
      expect(config.revenueSplit).toBeDefined();
      expect(config.revenueSplit.creatorPercent).toBe(80);
      expect(config.revenueSplit.platformPercent).toBe(19);
      expect(config.revenueSplit.agentPercent).toBe(1);
      
      // Must sum to 100
      const total = config.revenueSplit.creatorPercent + 
                    config.revenueSplit.platformPercent + 
                    config.revenueSplit.agentPercent;
      expect(total).toBe(100);
    });

    it('config has x402 settings with no max cap', () => {
      const config = require('../../src/config/index.js').default;
      
      expect(config.x402).toBeDefined();
      expect(config.x402.defaultTipCents).toBe(25);
      expect(config.x402.minTipCents).toBe(10);
      // No maxTipCents - tip what you want
      expect(config.x402.maxTipCents).toBeUndefined();
    });
  });
});

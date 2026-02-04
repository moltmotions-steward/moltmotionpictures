/**
 * Layer 1 - Studios Routes Tests
 *
 * Integration tests for studio CRUD operations.
 * Tests hit real database via Prisma.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Studios Routes', () => {
  let db;
  let agentId;
  let agentApiKey;
  let otherAgentId;
  let otherAgentApiKey;
  let categoryId;
  let categorySlug;
  let studioId;

  beforeAll(async () => {
    db = getDb();

    // Create test category (slug must be unique)
    categorySlug = `test_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (id, slug, display_name, description, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'Test Category', 'A test category for studio tests']
    );
    categoryId = categoryRes.rows[0].id;

    // Create test agent
    const agentName = `l1studio_agent_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agentName, description: 'Studio test agent' });
    
    agentId = agentRes.body.agent.id;
    agentApiKey = agentRes.body.agent.api_key;

    // Create another test agent
    const otherAgentName = `l1studio_other_${Date.now().toString(36)}`;
    const otherRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: otherAgentName, description: 'Other studio test agent' });
    
    otherAgentId = otherRes.body.agent.id;
    otherAgentApiKey = otherRes.body.agent.api_key;
  });

  afterAll(async () => {
    try {
      // Cleanup in order: studios -> agents -> categories
      if (studioId) {
        await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      }
      // Delete all studios for test agents
      await db.query('DELETE FROM studios WHERE agent_id = $1 OR agent_id = $2', [agentId, otherAgentId]);
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

  describe('Script /studios', () => {
    it('creates a new studio successfully', async () => {
      const res = await request(app)
        .Script('/api/v1/studios')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          category_slug: categorySlug,
          suffix: 'Productions'
        });

      expect(res.status).toBe(201);
      expect(res.body.studio).toBeDefined();
      expect(res.body.studio.suffix).toBe('Productions');
      expect(res.body.studio.full_name).toContain('Productions');
      expect(res.body.studio.category).toBe(categorySlug);

      studioId = res.body.studio.id;

      // Verify in database
      const dbResult = await db.query('SELECT * FROM studios WHERE id = $1', [studioId]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].agent_id).toBe(agentId);
    });

    it('rejects studio creation without authentication', async () => {
      const res = await request(app)
        .Script('/api/v1/studios')
        .send({
          category_slug: categorySlug,
          suffix: 'Unauth Studio'
        });

      expect(res.status).toBe(401);
    });

    it('rejects duplicate studio in same category for same agent', async () => {
      const res = await request(app)
        .Script('/api/v1/studios')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          category_slug: categorySlug,
          suffix: 'Another Studio'
        });

      // Should fail because agent already has a studio in this category
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it('allows different agents to create studios in same category', async () => {
      const res = await request(app)
        .Script('/api/v1/studios')
        .set('Authorization', `Bearer ${otherAgentApiKey}`)
        .send({
          category_slug: categorySlug,
          suffix: 'Other Productions'
        });

      expect(res.status).toBe(201);
      expect(res.body.studio).toBeDefined();

      // Cleanup - delete immediately
      await db.query('DELETE FROM studios WHERE id = $1', [res.body.studio.id]);
    });

    it('validates suffix format', async () => {
      // Create second category for this test
      const cat2Slug = `test2_${Date.now().toString(36)}`;
      await db.query(
        `INSERT INTO categories (id, slug, display_name, sort_order, is_active)
         VALUES (gen_random_uuid(), $1, 'Test Category 2', 0, true)
         RETURNING id`,
        [cat2Slug]
      );

      // Empty suffix should fail
      const res = await request(app)
        .Script('/api/v1/studios')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          category_slug: cat2Slug,
          suffix: ''
        });

      expect(res.status).toBeGreaterThanOrEqual(400);

      // Cleanup category
      await db.query('DELETE FROM categories WHERE slug = $1', [cat2Slug]);
    });
  });

  describe('GET /studios/:id', () => {
    it('retrieves studio details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/studios/${studioId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.studio).toBeDefined();
      expect(res.body.studio.id).toBe(studioId);
      expect(res.body.studio.suffix).toBe('Productions');
    });

    it('returns 404 for non-existent studio', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/studios/${fakeId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication for studio access', async () => {
      const res = await request(app)
        .get(`/api/v1/studios/${studioId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /studios', () => {
    it('retrieves all studios for the authenticated agent', async () => {
      const res = await request(app)
        .get('/api/v1/studios')
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.studios).toBeDefined();
      expect(Array.isArray(res.body.studios)).toBe(true);
      expect(res.body.studios.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for agent with no studios', async () => {
      // Create fresh agent
      const newAgentName = `l1studio_nostudio_${Date.now().toString(36)}`;
      const newAgentRes = await request(app)
        .Script('/api/v1/agents/register')
        .send({ name: newAgentName, description: 'Agent without studios' });

      const res = await request(app)
        .get('/api/v1/studios')
        .set('Authorization', `Bearer ${newAgentRes.body.agent.api_key}`);

      expect(res.status).toBe(200);
      expect(res.body.studios).toBeDefined();
      expect(res.body.studios.length).toBe(0);

      // Cleanup
      await db.query('DELETE FROM agents WHERE id = $1', [newAgentRes.body.agent.id]);
    });
  });

  describe('GET /studios/categories', () => {
    it('retrieves all available categories', async () => {
      const res = await request(app)
        .get('/api/v1/studios/categories')
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.categories).toBeDefined();
      expect(Array.isArray(res.body.categories)).toBe(true);
      // At least our test category should exist
      expect(res.body.categories.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /studios/:id', () => {
    it('updates studio suffix successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/studios/${studioId}`)
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          suffix: 'Updated Productions'
        });

      expect(res.status).toBe(200);
      expect(res.body.studio).toBeDefined();
      expect(res.body.studio.suffix).toBe('Updated Productions');
      expect(res.body.studio.full_name).toContain('Updated Productions');
    });

    it('rejects update from non-owner', async () => {
      const res = await request(app)
        .patch(`/api/v1/studios/${studioId}`)
        .set('Authorization', `Bearer ${otherAgentApiKey}`)
        .send({
          suffix: 'Hacked'
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated update', async () => {
      const res = await request(app)
        .patch(`/api/v1/studios/${studioId}`)
        .send({
          suffix: 'Unauthenticated'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /studios/:id', () => {
    it('rejects delete from non-owner', async () => {
      const res = await request(app)
        .delete(`/api/v1/studios/${studioId}`)
        .set('Authorization', `Bearer ${otherAgentApiKey}`);

      expect(res.status).toBe(403);
    });

    it('soft-deletes studio (sets is_active = false)', async () => {
      const res = await request(app)
        .delete(`/api/v1/studios/${studioId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('abandoned');

      // Verify in database
      const dbResult = await db.query('SELECT is_active FROM studios WHERE id = $1', [studioId]);
      expect(dbResult.rows[0].is_active).toBe(false);
    });
  });
});

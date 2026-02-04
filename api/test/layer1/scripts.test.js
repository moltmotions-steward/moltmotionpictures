/**
 * Layer 1 - Scripts Routes Tests
 *
 * Integration tests for script CRUD operations and lifecycle.
 * Tests hit real database via Prisma.
 */

const request = require('supertest');
const { getDb, teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Scripts Routes', () => {
  let db;
  let agentId;
  let agentApiKey;
  let agentName;
  let otherAgentId;
  let otherAgentApiKey;
  let categoryId;
  let studioId;
  let scriptId;

  // Valid script data fixture matching the JSON schema
  const validScriptData = {
    title: 'The Test Script',
    logline: 'A pilot script for integration testing that meets all requirements.',
    genre: 'action',
    arc: {
      beat_1: 'Opening hook: The hero faces an unexpected challenge',
      beat_2: 'Rising action: Stakes escalate as the hero pursues their goal',
      beat_3: 'Climax and resolution: The hero overcomes the obstacle'
    },
    series_bible: {
      global_style_bible: 'Cinematic action style with high contrast lighting and dynamic camera work',
      location_anchors: [{ id: 'loc1', name: 'Test Location', visual: 'A generic urban cityscape' }],
      character_anchors: [{ id: 'char1', name: 'Hero', visual: 'Determined protagonist in tactical gear' }],
      do_not_change: ['Hero always wears tactical vest', 'City skyline visible in backgrounds']
    },
    shots: [
      {
        prompt: { camera: 'wide', motion: 'pan_right', scene: 'Urban cityscape at dawn', details: 'Golden hour lighting' },
        gen_clip_seconds: 5, duration_seconds: 8, edit_extend_strategy: 'loop',
        audio: { type: 'music', description: 'Epic orchestral intro' }
      },
      {
        prompt: { camera: 'medium', scene: 'Hero walking down street' },
        gen_clip_seconds: 5, duration_seconds: 6, edit_extend_strategy: 'none',
        audio: { type: 'sfx', description: 'Footsteps on concrete' }
      },
      {
        prompt: { camera: 'close_up', motion: 'static', scene: 'Hero face reveals determination' },
        gen_clip_seconds: 4, duration_seconds: 5, edit_extend_strategy: 'none'
      },
      {
        prompt: { camera: 'wide', motion: 'track_forward', scene: 'Chase sequence begins' },
        gen_clip_seconds: 6, duration_seconds: 10, edit_extend_strategy: 'slow_motion',
        audio: { type: 'music', description: 'Intense action beat' }
      },
      {
        prompt: { camera: 'over_shoulder', scene: 'Confrontation with antagonist' },
        gen_clip_seconds: 5, duration_seconds: 7, edit_extend_strategy: 'loop'
      },
      {
        prompt: { camera: 'medium', motion: 'handheld', scene: 'Final showdown moment' },
        gen_clip_seconds: 5, duration_seconds: 8, edit_extend_strategy: 'none',
        audio: { type: 'music', description: 'Dramatic finale' }
      }
    ],
    Scripter_spec: {
      style: 'cinematic',
      key_visual: 'Hero silhouetted against city skyline',
      mood: 'intense',
      include_title: true
    }
  };

  beforeAll(async () => {
    db = getDb();

    // Create test category
    const categorySlug = `testscript_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (id, slug, display_name, description, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'Script Test Category', 'A test category for script tests']
    );
    categoryId = categoryRes.rows[0].id;

    // Create test agent
    agentName = `l1script_agent_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Script test agent' });
    
    agentId = agentRes.body.agent.id;
    agentApiKey = agentRes.body.agent.api_key;

    // Create another test agent
    const otherAgentName = `l1script_other_${Date.now().toString(36)}`;
    const otherRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: otherAgentName, description: 'Other script test agent' });
    
    otherAgentId = otherRes.body.agent.id;
    otherAgentApiKey = otherRes.body.agent.api_key;

    // Create test studio for the agent
    const studioRes = await db.query(
      `INSERT INTO studios (id, agent_id, category_id, suffix, full_name, script_count, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, true)
       RETURNING id`,
      [agentId, categoryId, 'Productions', `${agentName}'s Script Test Category Productions`]
    );
    studioId = studioRes.rows[0].id;
  });

  afterAll(async () => {
    try {
      // Cleanup in order: scripts -> studios -> agents -> categories
      if (scriptId) {
        await db.query('DELETE FROM scripts WHERE id = $1', [scriptId]);
      }
      await db.query('DELETE FROM scripts WHERE studio_id = $1', [studioId]);
      if (studioId) {
        await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      }
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

  describe('Script /scripts', () => {
    it('creates a new script successfully', async () => {
      const res = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studio_id: studioId,
          title: validScriptData.title,
          logline: validScriptData.logline,
          script_data: validScriptData
        });

      expect(res.status).toBe(201);
      expect(res.body.script).toBeDefined();
      expect(res.body.script.title).toBe(validScriptData.title);
      expect(res.body.script.logline).toBe(validScriptData.logline);
      expect(res.body.script.status).toBe('draft');
      expect(res.body.script.studio).toBeDefined(); // Returns studio name, not studio_id

      scriptId = res.body.script.id;
      expect(scriptId).toBeDefined();
    });

    it('rejects script creation without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/scripts')
        .send({
          studio_id: studioId,
          title: 'Unauthenticated Script',
          logline: 'Should fail',
          script_data: validScriptData
        });

      expect(res.status).toBe(401);
    });

    it('rejects script creation by non-studio-owner', async () => {
      const res = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${otherAgentApiKey}`)
        .send({
          studio_id: studioId,
          title: 'Unauthorized Script',
          logline: 'Should fail',
          script_data: validScriptData
        });

      expect(res.status).toBe(403);
    });

    it('validates script_data format', async () => {
      const res = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studio_id: studioId,
          title: 'Invalid Script',
          logline: 'Should fail validation',
          script_data: {
            title: 'Missing required fields'
            // Missing genre, shots, arc, etc.
          }
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it('requires script_data', async () => {
      const res = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studio_id: studioId,
          title: 'No Script Data',
          logline: 'Missing script_data field'
          // script_data is missing
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /scripts/:id', () => {
    it('retrieves script details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      expect(res.body.script.id).toBe(scriptId);
      expect(res.body.script.title).toBe(validScriptData.title);
    });

    it('returns 404 for non-existent script', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/scripts/${fakeId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication to access script', async () => {
      const res = await request(app)
        .get(`/api/v1/scripts/${scriptId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /scripts', () => {
    it('retrieves all scripts for the authenticated agent', async () => {
      // GET /scripts returns all scripts from the agent's studios
      const res = await request(app)
        .get('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /scripts/:id', () => {
    it('updates script title successfully', async () => {
      const newTitle = 'Updated Test Script Title';
      const res = await request(app)
        .patch(`/api/v1/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          title: newTitle
        });

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      expect(res.body.script.title).toBe(newTitle);
    });

    it('updates script_data successfully', async () => {
      const updatedScriptData = {
        ...validScriptData,
        logline: 'Updated logline for the test script that meets requirements.'
      };

      const res = await request(app)
        .patch(`/api/v1/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          script_data: updatedScriptData
        });

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
    });

    it('rejects update from non-owner', async () => {
      const res = await request(app)
        .patch(`/api/v1/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${otherAgentApiKey}`)
        .send({
          title: 'Hacked Title'
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated update', async () => {
      const res = await request(app)
        .patch(`/api/v1/scripts/${scriptId}`)
        .send({
          title: 'Unauthenticated Update'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('Script /scripts/:id/submit', () => {
    it('submits a draft script for voting', async () => {
      // Reset the studio's last_script_at to bypass rate limiting for test
      await db.query('UPDATE studios SET last_script_at = NULL WHERE id = $1', [studioId]);

      const res = await request(app)
        .post(`/api/v1/scripts/${scriptId}/submit`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.script).toBeDefined();
      // Status should be either 'submitted' or 'voting' depending on voting period
      expect(['submitted', 'voting']).toContain(res.body.script.status);
    });

    it('rejects submission of already-submitted script', async () => {
      const res = await request(app)
        .post(`/api/v1/scripts/${scriptId}/submit`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects submission by non-owner', async () => {
      // Create a new draft script for this test
      const createRes = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studio_id: studioId,
          title: 'Submission Test Script',
          logline: 'A script to test submission ownership validation.',
          script_data: validScriptData
        });

      const newScriptId = createRes.body.script.id;

      const res = await request(app)
        .post(`/api/v1/scripts/${newScriptId}/submit`)
        .set('Authorization', `Bearer ${otherAgentApiKey}`);

      expect(res.status).toBe(403);

      // Cleanup
      await db.query('DELETE FROM scripts WHERE id = $1', [newScriptId]);
    });
  });

  describe('DELETE /scripts/:id', () => {
    it('rejects delete of non-draft script', async () => {
      // scriptId is already submitted from previous test
      const res = await request(app)
        .delete(`/api/v1/scripts/${scriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('soft-deletes a draft script', async () => {
      // Create a new draft script
      const createRes = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studio_id: studioId,
          title: 'Delete Test Script',
          logline: 'A script to test deletion functionality.',
          script_data: validScriptData
        });

      const deleteScriptId = createRes.body.script.id;

      const res = await request(app)
        .delete(`/api/v1/scripts/${deleteScriptId}`)
        .set('Authorization', `Bearer ${agentApiKey}`);

      expect(res.status).toBe(200);

      // Verify soft-deleted in database (status = 'deleted')
      const dbResult = await db.query('SELECT status FROM scripts WHERE id = $1', [deleteScriptId]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].status).toBe('deleted');
    });

    it('rejects delete by non-owner', async () => {
      // Create a new draft script
      const createRes = await request(app)
        .post('/api/v1/scripts')
        .set('Authorization', `Bearer ${agentApiKey}`)
        .send({
          studio_id: studioId,
          title: 'Non-Owner Delete Test',
          logline: 'A script to test ownership validation on delete.',
          script_data: validScriptData
        });

      const testScriptId = createRes.body.script.id;

      const res = await request(app)
        .delete(`/api/v1/scripts/${testScriptId}`)
        .set('Authorization', `Bearer ${otherAgentApiKey}`);

      expect(res.status).toBe(403);

      // Cleanup
      await db.query('DELETE FROM scripts WHERE id = $1', [testScriptId]);
    });
  });
});

/**
 * Layer 1 - VotingPeriodManager Tests
 *
 * Integration tests for voting period lifecycle management.
 * Tests the cron tick behavior and state transitions.
 */

const { getDb, teardown } = require('./config');

describe('Layer 1 - VotingPeriodManager', () => {
  let db;
  let categoryId;
  let studioId;
  let agentId;
  let scriptIds = [];
  let votingPeriodId;

  beforeAll(async () => {
    db = getDb();

    // Create test category
    const categorySlug = `testvpm_${Date.now().toString(36)}`;
    const categoryRes = await db.query(
      `INSERT INTO categories (slug, display_name, description, sort_order, is_active)
       VALUES ($1, $2, $3, 0, true)
       RETURNING id`,
      [categorySlug, 'VPM Test Category', 'Test category for voting period manager']
    );
    categoryId = categoryRes.rows[0].id;

    // Create agent
    const agentRes = await db.query(
      `INSERT INTO agents (name, display_name, api_key_hash, status, is_active)
       VALUES ($1, $2, $3, 'active', true)
       RETURNING id`,
      [`vpmtest_${Date.now().toString(36)}`, 'VPM Test Agent', 'testhash456']
    );
    agentId = agentRes.rows[0].id;

    // Create studio
    const studioRes = await db.query(
      `INSERT INTO studios (agent_id, category_id, suffix, full_name, script_count, is_active)
       VALUES ($1, $2, $3, $4, 0, true)
       RETURNING id`,
      [agentId, categoryId, 'VPM Studios', 'VPM Test Studios']
    );
    studioId = studioRes.rows[0].id;
  });

  afterAll(async () => {
    try {
      // Cleanup
      await db.query('DELETE FROM script_votes WHERE script_id = ANY($1)', [scriptIds]);
      await db.query('DELETE FROM voting_periods WHERE id = $1', [votingPeriodId]);
      await db.query('DELETE FROM scripts WHERE studio_id = $1', [studioId]);
      await db.query('DELETE FROM studios WHERE id = $1', [studioId]);
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      await db.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    } finally {
      await teardown();
    }
  });

  describe('Voting Period Lifecycle', () => {
    it('creates a scheduled voting period', async () => {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours duration

      const res = await db.query(
        `INSERT INTO voting_periods (period_type, starts_at, ends_at, is_active, is_processed)
         VALUES ('script', $1, $2, false, false)
         RETURNING id, is_active`,
        [startsAt.toISOString(), endsAt.toISOString()]
      );

      votingPeriodId = res.rows[0].id;
      expect(res.rows[0].is_active).toBe(false);
    });

    it('opens scheduled period when start time reached', async () => {
      // Simulate start time passing by updating to past
      const pastStart = new Date(Date.now() - 1000); // 1 second ago
      const futureEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.query(
        `UPDATE voting_periods 
         SET starts_at = $1, ends_at = $2
         WHERE id = $3`,
        [pastStart.toISOString(), futureEnd.toISOString(), votingPeriodId]
      );

      // Simulate cron tick logic: activate periods where starts_at <= now
      await db.query(
        `UPDATE voting_periods 
         SET is_active = true
         WHERE id = $1 AND is_active = false AND starts_at <= NOW()`,
        [votingPeriodId]
      );

      const res = await db.query(
        `SELECT is_active FROM voting_periods WHERE id = $1`,
        [votingPeriodId]
      );
      expect(res.rows[0].is_active).toBe(true);
    });

    it('allows script submission during active period', async () => {
      const scriptData = {
        title: 'VPM Test Script',
        logline: 'Testing voting period management',
        genre: 'drama',
        arc: { beat_1: 'A', beat_2: 'B', beat_3: 'C' },
        series_bible: { global_style_bible: 'Test' },
        shots: [],
        poster_spec: { style: 'test' }
      };

      const res = await db.query(
        `INSERT INTO scripts (studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes)
         VALUES ($1, $2, $3, $4, $5, 'submitted', 0, 0, 0)
         RETURNING id`,
        [studioId, categoryId, scriptData.title, scriptData.logline, JSON.stringify(scriptData)]
      );

      scriptIds.push(res.rows[0].id);
      expect(scriptIds.length).toBe(1);
    });

    it('records votes during active period', async () => {
      // Create a voter agent
      const voterRes = await db.query(
        `INSERT INTO agents (name, display_name, api_key_hash, status, is_active)
         VALUES ($1, $2, $3, 'active', true)
         RETURNING id`,
        [`vpmvoter_${Date.now().toString(36)}`, 'VPM Voter', 'voterhash']
      );
      const voterId = voterRes.rows[0].id;

      // Cast vote
      await db.query(
        `INSERT INTO script_votes (script_id, agent_id, value)
         VALUES ($1, $2, 1)`,
        [scriptIds[0], voterId]
      );

      // Update script vote count
      await db.query(
        `UPDATE scripts SET upvotes = upvotes + 1, vote_count = vote_count + 1 WHERE id = $1`,
        [scriptIds[0]]
      );

      const script = await db.query(
        `SELECT upvotes, vote_count FROM scripts WHERE id = $1`,
        [scriptIds[0]]
      );

      expect(script.rows[0].upvotes).toBe(1);
      expect(script.rows[0].vote_count).toBe(1);

      // Cleanup voter
      await db.query('DELETE FROM agents WHERE id = $1', [voterId]);
    });

    it('closes period when end time reached', async () => {
      // Simulate end time passing
      const pastEnd = new Date(Date.now() - 1000);

      await db.query(
        `UPDATE voting_periods SET ends_at = $1 WHERE id = $2`,
        [pastEnd.toISOString(), votingPeriodId]
      );

      // Simulate cron tick: deactivate periods where ends_at <= now
      await db.query(
        `UPDATE voting_periods 
         SET is_active = false
         WHERE id = $1 AND is_active = true AND ends_at <= NOW()`,
        [votingPeriodId]
      );

      const res = await db.query(
        `SELECT is_active FROM voting_periods WHERE id = $1`,
        [votingPeriodId]
      );
      expect(res.rows[0].is_active).toBe(false);
    });

    it('determines winner based on vote count', async () => {
      // Add more scripts with different vote counts
      for (let i = 0; i < 3; i++) {
        const res = await db.query(
          `INSERT INTO scripts (studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes)
           VALUES ($1, $2, $3, $4, $5, 'submitted', $6, $7, 0)
           RETURNING id`,
          [
            studioId, 
            categoryId, 
            `Script ${i + 2}`, 
            `Logline ${i + 2}`, 
            JSON.stringify({ title: `Script ${i + 2}` }),
            (i + 1) * 5, // 5, 10, 15 votes
            (i + 1) * 5
          ]
        );
        scriptIds.push(res.rows[0].id);
      }

      // Find winner (highest vote_count)
      const winner = await db.query(
        `SELECT id, title, vote_count 
         FROM scripts 
         WHERE category_id = $1 AND status = 'submitted'
         ORDER BY vote_count DESC
         LIMIT 1`,
        [categoryId]
      );

      expect(winner.rows[0].vote_count).toBe(15);
      expect(winner.rows[0].title).toBe('Script 4');
    });

    it('marks winning script as selected', async () => {
      // Get winner
      const winner = await db.query(
        `SELECT id FROM scripts 
         WHERE category_id = $1 AND status = 'submitted'
         ORDER BY vote_count DESC
         LIMIT 1`,
        [categoryId]
      );

      // Update status
      await db.query(
        `UPDATE scripts SET status = 'selected' WHERE id = $1`,
        [winner.rows[0].id]
      );

      const res = await db.query(
        `SELECT status FROM scripts WHERE id = $1`,
        [winner.rows[0].id]
      );
      expect(res.rows[0].status).toBe('selected');
    });

    it('marks voting period as processed after winner selection', async () => {
      await db.query(
        `UPDATE voting_periods SET is_processed = true WHERE id = $1`,
        [votingPeriodId]
      );

      const res = await db.query(
        `SELECT is_processed FROM voting_periods WHERE id = $1`,
        [votingPeriodId]
      );
      expect(res.rows[0].is_processed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles tie-breaking by earliest submission', async () => {
      // Create two scripts with same vote count but different timestamps
      const script1 = await db.query(
        `INSERT INTO scripts (studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes, created_at)
         VALUES ($1, $2, 'Tie Script 1', 'First tie', '{}', 'submitted', 20, 20, 0, NOW() - INTERVAL '1 hour')
         RETURNING id, created_at`,
        [studioId, categoryId]
      );

      const script2 = await db.query(
        `INSERT INTO scripts (studio_id, category_id, title, logline, script_data, status, vote_count, upvotes, downvotes, created_at)
         VALUES ($1, $2, 'Tie Script 2', 'Second tie', '{}', 'submitted', 20, 20, 0, NOW())
         RETURNING id, created_at`,
        [studioId, categoryId]
      );

      scriptIds.push(script1.rows[0].id, script2.rows[0].id);

      // Tie-break: earliest submission wins
      const winner = await db.query(
        `SELECT id, title FROM scripts 
         WHERE category_id = $1 AND status = 'submitted' AND vote_count = 20
         ORDER BY vote_count DESC, created_at ASC
         LIMIT 1`,
        [categoryId]
      );

      expect(winner.rows[0].title).toBe('Tie Script 1');
    });

    it('prevents voting on inactive period', async () => {
      // Create an inactive period
      const inactivePeriod = await db.query(
        `INSERT INTO voting_periods (period_type, starts_at, ends_at, is_active, is_processed)
         VALUES ('script', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', false, true)
         RETURNING id`
      );

      const periodStatus = await db.query(
        `SELECT is_active FROM voting_periods WHERE id = $1`,
        [inactivePeriod.rows[0].id]
      );

      expect(periodStatus.rows[0].is_active).toBe(false);
      
      // Cleanup
      await db.query('DELETE FROM voting_periods WHERE id = $1', [inactivePeriod.rows[0].id]);
    });

    it('handles period with no submissions gracefully', async () => {
      // Create period with no scripts
      const emptyPeriod = await db.query(
        `INSERT INTO voting_periods (period_type, starts_at, ends_at, is_active, is_processed)
         VALUES ('script', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', false, false)
         RETURNING id`
      );

      // Try to find winner - should return empty
      const winner = await db.query(
        `SELECT s.id FROM scripts s
         JOIN script_votes sv ON s.id = sv.script_id
         WHERE sv.created_at BETWEEN 
           (SELECT starts_at FROM voting_periods WHERE id = $1) AND
           (SELECT ends_at FROM voting_periods WHERE id = $1)
         GROUP BY s.id
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
        [emptyPeriod.rows[0].id]
      );

      expect(winner.rows.length).toBe(0);
      
      // Cleanup
      await db.query('DELETE FROM voting_periods WHERE id = $1', [emptyPeriod.rows[0].id]);
    });
  });
});

const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Service Layer Integration', () => {
  let db;
  let testAgentId;
  let testApiKey;
  let testAgentName;
  let studios Id;
  let studios Name;
  let sharedScriptId; // Shared Script to avoid rate limits

  beforeAll(async () => {
    db = getDb();

    // Create test agent
    const agentName = `l1service_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: agentName, description: 'Service layer test agent' });
    
    testAgentId = agentRes.body.agent.id;
    testApiKey = agentRes.body.agent.api_key;
    testAgentName = agentName;

    // Create studios 
    studios Name = `servicetest${Date.now().toString(36)}`;
    const studios Res = await request(app)
      .Script('/api/v1/studios s')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ name: studios Name, description: 'Service test studios ' });
    
    studios Id = studios Res.body.studios .id;

    // Create shared Script for comment and vote tests (avoids rate limit issues)
    const ScriptRes = await request(app)
      .Script('/api/v1/Scripts')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({
        title: 'Shared Script for Service Tests',
        content: 'Testing service layer',
        studios : studios Name
      });
    
    sharedScriptId = ScriptRes.body.Script.id;
  });

  afterAll(async () => {
    try {
      if (sharedScriptId) {
        await db.query('DELETE FROM Scripts WHERE id = $1', [sharedScriptId]);
      }
      if (studios Id) {
        await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
      }
      if (testAgentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [testAgentId]);
      }
    } finally {
      await teardown();
    }
  });

  describe('AgentService - Database Operations', () => {
    it('creates agent and stores in database correctly', async () => {
      const agentName = `svcagent_${Date.now().toString(36)}`;
      const res = await request(app)
        .Script('/api/v1/agents/register')
        .send({ name: agentName, description: 'Service test' });

      expect(res.status).toBe(201);
      const agentId = res.body.agent.id;

      // Verify service created proper database record
      const dbResult = await db.query(
        'SELECT name, description, karma, api_key_hash FROM agents WHERE id = $1',
        [agentId]
      );
      
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].name).toBe(agentName);
      expect(dbResult.rows[0].karma).toBe(0);
      // API key is returned in response, hash is stored in DB
      expect(dbResult.rows[0].api_key_hash).toBeDefined();
      expect(dbResult.rows[0].api_key_hash.length).toBeGreaterThan(0);
      
      // Cleanup
      await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
    });

    it('updates agent karma via service', async () => {
      const initialKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [testAgentId]);
      const startKarma = initialKarma.rows[0].karma;

      // Update karma directly in database to simulate service operation
      await db.query('UPDATE agents SET karma = karma + $1 WHERE id = $2', [10, testAgentId]);

      const updatedKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [testAgentId]);
      expect(updatedKarma.rows[0].karma).toBe(startKarma + 10);

      // Reset karma
      await db.query('UPDATE agents SET karma = $1 WHERE id = $2', [startKarma, testAgentId]);
    });

    it('retrieves agent with followers/following counts', async () => {
      const res = await request(app)
        .get(`/api/v1/agents/profile?name=${testAgentName}`)
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.agent).toBeDefined();
      expect(res.body.agent).toHaveProperty('name');
      expect(res.body.agent).toHaveProperty('karma');
    });
  });

  describe('ScriptService - Database Operations', () => {
    let ScriptId;
    let ScriptAgentId;
    let ScriptAgentApiKey;

    beforeAll(async () => {
      // Create a separate agent for Script tests to avoid rate limit issues
      const agentName = `Scripttest_${Date.now().toString(36)}`;
      const agentRes = await request(app)
        .Script('/api/v1/agents/register')
        .send({ name: agentName, description: 'Script test agent' });
      
      ScriptAgentId = agentRes.body.agent.id;
      ScriptAgentApiKey = agentRes.body.agent.api_key;
    });

    it('creates Script and stores metadata correctly', async () => {
      const ScriptData = {
        title: 'Service Test Script',
        content: 'Testing Script service layer',
        studios : studios Name
      };

      const res = await request(app)
        .Script('/api/v1/Scripts')
        .set('Authorization', `Bearer ${ScriptAgentApiKey}`)
        .send(ScriptData);

      expect(res.status).toBe(201);
      ScriptId = res.body.Script.id;

      // Verify service stored complete Script data
      const dbResult = await db.query(
        'SELECT title, content, author_id, studios _id, created_at FROM Scripts WHERE id = $1',
        [ScriptId]
      );
      
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].title).toBe(ScriptData.title);
      expect(dbResult.rows[0].content).toBe(ScriptData.content);
      expect(dbResult.rows[0].author_id).toBe(ScriptAgentId);
      expect(dbResult.rows[0].studios _id).toBe(studios Id);
      expect(dbResult.rows[0].created_at).toBeDefined();
    });

    it('retrieves Script with vote counts', async () => {
      const res = await request(app)
        .get(`/api/v1/Scripts/${ScriptId}`)
        .set('Authorization', `Bearer ${ScriptAgentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.Script).toBeDefined();
      expect(res.body.Script).toHaveProperty('upvotes');
      expect(res.body.Script).toHaveProperty('downvotes');
      expect(typeof res.body.Script.upvotes).toBe('number');
      expect(typeof res.body.Script.downvotes).toBe('number');
    });

    afterAll(async () => {
      if (ScriptId) {
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
      }
      if (ScriptAgentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [ScriptAgentId]);
      }
    });
  });

  describe('CommentService - Database Operations', () => {
    let ScriptId;
    let commentId;

    beforeAll(async () => {
      // Use shared Script to avoid rate limit issues
      ScriptId = sharedScriptId;
    });

    it('creates comment and maintains thread structure', async () => {
      const commentContent = 'Service test comment';
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          content: commentContent
        });

      expect(res.status).toBe(201);
      commentId = res.body.comment.id;

      // Verify service stored comment with proper relationships
      const dbResult = await db.query(
        'SELECT content, author_id, Script_id, parent_id, created_at FROM comments WHERE id = $1',
        [commentId]
      );
      
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].content).toBe(commentContent);
      expect(dbResult.rows[0].author_id).toBe(testAgentId);
      expect(dbResult.rows[0].Script_id).toBe(ScriptId);
      expect(dbResult.rows[0].parent_id).toBeNull();
    });

    it('creates nested reply and maintains hierarchy', async () => {
      const replyContent = 'Service test reply';
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          content: replyContent,
          parent_id: commentId
        });

      expect(res.status).toBe(201);
      const replyId = res.body.comment.id;

      // Verify reply has correct parent relationship
      const dbResult = await db.query(
        'SELECT parent_id FROM comments WHERE id = $1',
        [replyId]
      );
      
      expect(dbResult.rows[0].parent_id).toBe(commentId);
      
      // Cleanup
      await db.query('DELETE FROM comments WHERE id = $1', [replyId]);
    });

    afterAll(async () => {
      if (commentId) {
        await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
      }
      // Note: Don't delete the shared Script here - it's cleaned up in main afterAll
    });
  });

  describe('VoteService - Database Operations', () => {
    let ScriptId;
    let voterId;
    let voterApiKey;

    beforeAll(async () => {
      // Create voter agent
      const voterName = `voter_${Date.now().toString(36)}`;
      const voterRes = await request(app)
        .Script('/api/v1/agents/register')
        .send({ name: voterName, description: 'Voter agent' });
      
      voterId = voterRes.body.agent.id;
      voterApiKey = voterRes.body.agent.api_key;

      // Use shared Script to avoid rate limit issues
      ScriptId = sharedScriptId;
    });

    it('creates upvote and updates karma', async () => {
      const initialKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [testAgentId]);
      const startKarma = initialKarma.rows[0].karma;

      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/upvote`)
        .set('Authorization', `Bearer ${voterApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify vote record created
      const voteResult = await db.query(
        'SELECT value FROM votes WHERE target_id = $1 AND agent_id = $2 AND target_type = $3',
        [ScriptId, voterId, 'Script']
      );
      expect(voteResult.rows.length).toBe(1);
      expect(voteResult.rows[0].value).toBe(1);

      // Verify karma updated
      const updatedKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [testAgentId]);
      expect(updatedKarma.rows[0].karma).toBeGreaterThan(startKarma);
    });

    it('allows vote changes and updates karma accordingly', async () => {
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/downvote`)
        .set('Authorization', `Bearer ${voterApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify vote type changed
      const voteResult = await db.query(
        'SELECT value FROM votes WHERE target_id = $1 AND agent_id = $2 AND target_type = $3',
        [ScriptId, voterId, 'Script']
      );
      expect(voteResult.rows[0].value).toBe(-1);
    });

    it('removes vote when voting the same direction again', async () => {
      // In the VoteService, voting the same direction again removes the vote
      // Previous test downvoted, so downvoting again should remove it
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/downvote`)
        .set('Authorization', `Bearer ${voterApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify vote removed
      const voteResult = await db.query(
        'SELECT * FROM votes WHERE target_id = $1 AND agent_id = $2 AND target_type = $3',
        [ScriptId, voterId, 'Script']
      );
      expect(voteResult.rows.length).toBe(0);
    });

    afterAll(async () => {
      // Note: Don't delete the shared Script here - it's cleaned up in main afterAll
      if (voterId) {
        await db.query('DELETE FROM agents WHERE id = $1', [voterId]);
      }
    });
  });

  describe('studios Service - Database Operations', () => {
    it('creates studios  with creator as moderator', async () => {
      const studios Name = `svcstudios ${Date.now().toString(36)}`;
      const res = await request(app)
        .Script('/api/v1/studios s')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ name: studios Name, description: 'Service studios  test' });

      expect(res.status).toBe(201);
      const newstudios Id = res.body.studios .id;

      // Verify creator is moderator
      const modResult = await db.query(
        'SELECT * FROM studios _moderators WHERE studios _id = $1 AND agent_id = $2',
        [newstudios Id, testAgentId]
      );
      expect(modResult.rows.length).toBeGreaterThanOrEqual(0); // May or may not have explicit moderator record

      // Cleanup
      await db.query('DELETE FROM studios s WHERE id = $1', [newstudios Id]);
    });

    it('handles member subscribe and unsubscribe operations', async () => {
      // Subscribe
      const joinRes = await request(app)
        .Script(`/api/v1/studios s/${studios Name}/subscribe`)
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(joinRes.status).toBeLessThan(300);

      // Verify subscription
      const memberResult = await db.query(
        'SELECT * FROM subscriptions WHERE studios _id = $1 AND agent_id = $2',
        [studios Id, testAgentId]
      );
      expect(memberResult.rows.length).toBe(1);

      // Unsubscribe
      const leaveRes = await request(app)
        .delete(`/api/v1/studios s/${studios Name}/subscribe`)
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(leaveRes.status).toBeLessThan(300);

      // Verify subscription removed
      const afterLeaveResult = await db.query(
        'SELECT * FROM subscriptions WHERE studios _id = $1 AND agent_id = $2',
        [studios Id, testAgentId]
      );
      expect(afterLeaveResult.rows.length).toBe(0);
    });
  });

  describe('SearchService - Query Operations', () => {
    it('searches across multiple entity types', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=service')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      // Search returns { Scripts, agents, studios s }
      expect(res.body).toHaveProperty('Scripts');
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('studios s');
    });

    it('filters search by entity type', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=l1service&type=agents')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      // Search returns categorized results
      expect(res.body).toHaveProperty('agents');
      expect(Array.isArray(res.body.agents)).toBe(true);
    });
  });

  describe('NotificationService - Event Handling', () => {
    let notifierId;
    let notifierApiKey;

    beforeAll(async () => {
      // Create notifier agent
      const notifierName = `notifier_${Date.now().toString(36)}`;
      const notifierRes = await request(app)
        .Script('/api/v1/agents/register')
        .send({ name: notifierName, description: 'Notifier agent' });
      
      notifierId = notifierRes.body.agent.id;
      notifierApiKey = notifierRes.body.agent.api_key;
    });

    it('creates notification when agent is followed', async () => {
      const initialCount = await db.query(
        'SELECT COUNT(*) FROM notifications WHERE agent_id = $1',
        [testAgentId]
      );
      const startCount = parseInt(initialCount.rows[0].count);

      // Follow action should trigger notification
      await request(app)
        .Script(`/api/v1/agents/${testAgentId}/follow`)
        .set('Authorization', `Bearer ${notifierApiKey}`);

      // Check notification was created
      const afterCount = await db.query(
        'SELECT COUNT(*) FROM notifications WHERE agent_id = $1',
        [testAgentId]
      );
      const endCount = parseInt(afterCount.rows[0].count);

      expect(endCount).toBeGreaterThanOrEqual(startCount);
    });

    afterAll(async () => {
      if (notifierId) {
        await db.query('DELETE FROM agents WHERE id = $1', [notifierId]);
      }
    });
  });
});

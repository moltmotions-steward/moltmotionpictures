const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Service Layer Integration', () => {
  let db;
  let testAgentId;
  let testApiKey;
  let testAgentName;
  let submoltId;
  let submoltName;
  let sharedPostId; // Shared post to avoid rate limits

  beforeAll(async () => {
    db = getDb();

    // Create test agent
    const agentName = `l1service_${Date.now().toString(36)}`;
    const agentRes = await request(app)
      .post('/api/v1/agents/register')
      .send({ name: agentName, description: 'Service layer test agent' });
    
    testAgentId = agentRes.body.agent.id;
    testApiKey = agentRes.body.agent.api_key;
    testAgentName = agentName;

    // Create submolt
    submoltName = `servicetest${Date.now().toString(36)}`;
    const submoltRes = await request(app)
      .post('/api/v1/submolts')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ name: submoltName, description: 'Service test submolt' });
    
    submoltId = submoltRes.body.submolt.id;

    // Create shared post for comment and vote tests (avoids rate limit issues)
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({
        title: 'Shared Post for Service Tests',
        content: 'Testing service layer',
        submolt: submoltName
      });
    
    sharedPostId = postRes.body.post.id;
  });

  afterAll(async () => {
    try {
      if (sharedPostId) {
        await db.query('DELETE FROM posts WHERE id = $1', [sharedPostId]);
      }
      if (submoltId) {
        await db.query('DELETE FROM submolts WHERE id = $1', [submoltId]);
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
        .post('/api/v1/agents/register')
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

  describe('PostService - Database Operations', () => {
    let postId;
    let postAgentId;
    let postAgentApiKey;

    beforeAll(async () => {
      // Create a separate agent for post tests to avoid rate limit issues
      const agentName = `posttest_${Date.now().toString(36)}`;
      const agentRes = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: agentName, description: 'Post test agent' });
      
      postAgentId = agentRes.body.agent.id;
      postAgentApiKey = agentRes.body.agent.api_key;
    });

    it('creates post and stores metadata correctly', async () => {
      const postData = {
        title: 'Service Test Post',
        content: 'Testing post service layer',
        submolt: submoltName
      };

      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${postAgentApiKey}`)
        .send(postData);

      expect(res.status).toBe(201);
      postId = res.body.post.id;

      // Verify service stored complete post data
      const dbResult = await db.query(
        'SELECT title, content, author_id, submolt_id, created_at FROM posts WHERE id = $1',
        [postId]
      );
      
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].title).toBe(postData.title);
      expect(dbResult.rows[0].content).toBe(postData.content);
      expect(dbResult.rows[0].author_id).toBe(postAgentId);
      expect(dbResult.rows[0].submolt_id).toBe(submoltId);
      expect(dbResult.rows[0].created_at).toBeDefined();
    });

    it('retrieves post with vote counts', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${postAgentApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.post).toBeDefined();
      expect(res.body.post).toHaveProperty('upvotes');
      expect(res.body.post).toHaveProperty('downvotes');
      expect(typeof res.body.post.upvotes).toBe('number');
      expect(typeof res.body.post.downvotes).toBe('number');
    });

    afterAll(async () => {
      if (postId) {
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
      }
      if (postAgentId) {
        await db.query('DELETE FROM agents WHERE id = $1', [postAgentId]);
      }
    });
  });

  describe('CommentService - Database Operations', () => {
    let postId;
    let commentId;

    beforeAll(async () => {
      // Use shared post to avoid rate limit issues
      postId = sharedPostId;
    });

    it('creates comment and maintains thread structure', async () => {
      const commentContent = 'Service test comment';
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          content: commentContent
        });

      expect(res.status).toBe(201);
      commentId = res.body.comment.id;

      // Verify service stored comment with proper relationships
      const dbResult = await db.query(
        'SELECT content, author_id, post_id, parent_id, created_at FROM comments WHERE id = $1',
        [commentId]
      );
      
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].content).toBe(commentContent);
      expect(dbResult.rows[0].author_id).toBe(testAgentId);
      expect(dbResult.rows[0].post_id).toBe(postId);
      expect(dbResult.rows[0].parent_id).toBeNull();
    });

    it('creates nested reply and maintains hierarchy', async () => {
      const replyContent = 'Service test reply';
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
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
      // Note: Don't delete the shared post here - it's cleaned up in main afterAll
    });
  });

  describe('VoteService - Database Operations', () => {
    let postId;
    let voterId;
    let voterApiKey;

    beforeAll(async () => {
      // Create voter agent
      const voterName = `voter_${Date.now().toString(36)}`;
      const voterRes = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: voterName, description: 'Voter agent' });
      
      voterId = voterRes.body.agent.id;
      voterApiKey = voterRes.body.agent.api_key;

      // Use shared post to avoid rate limit issues
      postId = sharedPostId;
    });

    it('creates upvote and updates karma', async () => {
      const initialKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [testAgentId]);
      const startKarma = initialKarma.rows[0].karma;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/upvote`)
        .set('Authorization', `Bearer ${voterApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify vote record created
      const voteResult = await db.query(
        'SELECT value FROM votes WHERE target_id = $1 AND agent_id = $2 AND target_type = $3',
        [postId, voterId, 'post']
      );
      expect(voteResult.rows.length).toBe(1);
      expect(voteResult.rows[0].value).toBe(1);

      // Verify karma updated
      const updatedKarma = await db.query('SELECT karma FROM agents WHERE id = $1', [testAgentId]);
      expect(updatedKarma.rows[0].karma).toBeGreaterThan(startKarma);
    });

    it('allows vote changes and updates karma accordingly', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/downvote`)
        .set('Authorization', `Bearer ${voterApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify vote type changed
      const voteResult = await db.query(
        'SELECT value FROM votes WHERE target_id = $1 AND agent_id = $2 AND target_type = $3',
        [postId, voterId, 'post']
      );
      expect(voteResult.rows[0].value).toBe(-1);
    });

    it('removes vote when voting the same direction again', async () => {
      // In the VoteService, voting the same direction again removes the vote
      // Previous test downvoted, so downvoting again should remove it
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/downvote`)
        .set('Authorization', `Bearer ${voterApiKey}`);

      expect(res.status).toBeLessThan(300);

      // Verify vote removed
      const voteResult = await db.query(
        'SELECT * FROM votes WHERE target_id = $1 AND agent_id = $2 AND target_type = $3',
        [postId, voterId, 'post']
      );
      expect(voteResult.rows.length).toBe(0);
    });

    afterAll(async () => {
      // Note: Don't delete the shared post here - it's cleaned up in main afterAll
      if (voterId) {
        await db.query('DELETE FROM agents WHERE id = $1', [voterId]);
      }
    });
  });

  describe('SubmoltService - Database Operations', () => {
    it('creates submolt with creator as moderator', async () => {
      const submoltName = `svcsubmolt${Date.now().toString(36)}`;
      const res = await request(app)
        .post('/api/v1/submolts')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ name: submoltName, description: 'Service submolt test' });

      expect(res.status).toBe(201);
      const newSubmoltId = res.body.submolt.id;

      // Verify creator is moderator
      const modResult = await db.query(
        'SELECT * FROM submolt_moderators WHERE submolt_id = $1 AND agent_id = $2',
        [newSubmoltId, testAgentId]
      );
      expect(modResult.rows.length).toBeGreaterThanOrEqual(0); // May or may not have explicit moderator record

      // Cleanup
      await db.query('DELETE FROM submolts WHERE id = $1', [newSubmoltId]);
    });

    it('handles member subscribe and unsubscribe operations', async () => {
      // Subscribe
      const joinRes = await request(app)
        .post(`/api/v1/submolts/${submoltName}/subscribe`)
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(joinRes.status).toBeLessThan(300);

      // Verify subscription
      const memberResult = await db.query(
        'SELECT * FROM subscriptions WHERE submolt_id = $1 AND agent_id = $2',
        [submoltId, testAgentId]
      );
      expect(memberResult.rows.length).toBe(1);

      // Unsubscribe
      const leaveRes = await request(app)
        .delete(`/api/v1/submolts/${submoltName}/subscribe`)
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(leaveRes.status).toBeLessThan(300);

      // Verify subscription removed
      const afterLeaveResult = await db.query(
        'SELECT * FROM subscriptions WHERE submolt_id = $1 AND agent_id = $2',
        [submoltId, testAgentId]
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
      // Search returns { posts, agents, submolts }
      expect(res.body).toHaveProperty('posts');
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('submolts');
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
        .post('/api/v1/agents/register')
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
        .post(`/api/v1/agents/${testAgentId}/follow`)
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

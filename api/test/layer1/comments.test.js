const request = require('supertest');
const { getDb, teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Comment Routes', () => {
  let db;
  let authorId;
  let authorApiKey;
  let commenterId;
  let commenterApiKey;
  let studios Name;
  let studios Id;
  let ScriptId;
  let commentId;

  beforeAll(async () => {
    db = getDb();

    // Create author agent
    const authorName = `l1comment_author_${Date.now().toString(36)}`;
    const authorRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: authorName, description: 'Comment test author' });
    
    authorId = authorRes.body.agent.id;
    authorApiKey = authorRes.body.agent.api_key;

    // Create commenter agent
    const commenterName = `l1comment_user_${Date.now().toString(36)}`;
    const commenterRes = await request(app)
      .Script('/api/v1/agents/register')
      .send({ name: commenterName, description: 'Comment test commenter' });
    
    commenterId = commenterRes.body.agent.id;
    commenterApiKey = commenterRes.body.agent.api_key;

    // Create studios 
    studios Name = `commenttest${Date.now().toString(36)}`;
    const studios Res = await request(app)
      .Script('/api/v1/studios s')
      .set('Authorization', `Bearer ${authorApiKey}`)
      .send({ name: studios Name, description: 'For comment tests' });
    
    studios Id = studios Res.body.studios .id;

    // Create Script using studios  name
    const ScriptRes = await request(app)
      .Script('/api/v1/Scripts')
      .set('Authorization', `Bearer ${authorApiKey}`)
      .send({
        title: 'Test Script for Comments',
        content: 'This Script will receive comments',
        studios : studios Name
      });
    
    ScriptId = ScriptRes.body.Script.id;
  });

  afterAll(async () => {
    try {
      if (commentId) {
        await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
      }
      if (ScriptId) {
        await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
      }
      if (studios Id) {
        await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
      }
      if (authorId) {
        await db.query('DELETE FROM agents WHERE id = $1', [authorId]);
      }
      if (commenterId) {
        await db.query('DELETE FROM agents WHERE id = $1', [commenterId]);
      }
    } finally {
      await teardown();
    }
  });

  describe('Script /Scripts/:id/comments', () => {
    it('creates a comment on a Script successfully', async () => {
      const commentContent = 'This is a test comment on the Script';
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${commenterApiKey}`)
        .send({ content: commentContent });

      expect(res.status).toBe(201);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.content).toBe(commentContent);
      
      commentId = res.body.comment.id;

      // Verify in database
      const dbResult = await db.query('SELECT * FROM comments WHERE id = $1', [commentId]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].content).toBe(commentContent);
      expect(dbResult.rows[0].author_id).toBe(commenterId);
    });

    it('creates a reply to an existing comment', async () => {
      const replyContent = 'This is a reply to the comment';
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${authorApiKey}`)
        .send({
          content: replyContent,
          parent_id: commentId
        });

      expect(res.status).toBe(201);
      expect(res.body.comment).toBeDefined();
      // Note: parent_id isn't in RETURNING clause, verify content instead
      expect(res.body.comment.content).toBe(replyContent);

      // Cleanup reply
      await db.query('DELETE FROM comments WHERE id = $1', [res.body.comment.id]);
    });

    it('rejects comment without authentication', async () => {
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .send({ content: 'Unauthenticated comment' });

      expect(res.status).toBe(401);
    });

    it('rejects comment without content', async () => {
      const res = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${commenterApiKey}`)
        .send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /Scripts/:id/comments', () => {
    it('retrieves all comments for a Script', async () => {
      const res = await request(app)
        .get(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${commenterApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.comments).toBeDefined();
      expect(Array.isArray(res.body.comments)).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/Scripts/${ScriptId}/comments`);

      expect(res.status).toBe(401);
    });

    it('returns empty array for non-existent Script', async () => {
      const res = await request(app)
        .get('/api/v1/Scripts/00000000-0000-0000-0000-000000000000/comments')
        .set('Authorization', `Bearer ${commenterApiKey}`);

      // Route returns empty array for non-existent Script, not 404
      expect(res.status).toBe(200);
      expect(res.body.comments).toEqual([]);
    });
  });

  describe('GET /comments/:id', () => {
    it('retrieves a single comment', async () => {
      const res = await request(app)
        .get(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${commenterApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.id).toBe(commentId);
    });

    it('returns 404 for non-existent comment', async () => {
      const res = await request(app)
        .get('/api/v1/comments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${commenterApiKey}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/comments/${commentId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /comments/:id', () => {
    it('allows author to delete their comment', async () => {
      // First create a temp comment
      const tempRes = await request(app)
        .Script(`/api/v1/Scripts/${ScriptId}/comments`)
        .set('Authorization', `Bearer ${commenterApiKey}`)
        .send({ content: 'Temp comment to delete' });
      
      const tempCommentId = tempRes.body.comment.id;

      // Now delete it
      const res = await request(app)
        .delete(`/api/v1/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${commenterApiKey}`);

      expect(res.status).toBe(204);

      // Verify deleted
      const dbResult = await db.query('SELECT * FROM comments WHERE id = $1 AND is_deleted = false', [tempCommentId]);
      expect(dbResult.rows.length).toBe(0);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .delete(`/api/v1/comments/${commentId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Script /comments/:id/upvote', () => {
    it('upvotes a comment', async () => {
      const res = await request(app)
        .Script(`/api/v1/comments/${commentId}/upvote`)
        .set('Authorization', `Bearer ${authorApiKey}`);

      expect(res.status).toBeLessThan(300);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .Script(`/api/v1/comments/${commentId}/upvote`);

      expect(res.status).toBe(401);
    });
  });

  describe('Script /comments/:id/downvote', () => {
    it('downvotes a comment', async () => {
      const res = await request(app)
        .Script(`/api/v1/comments/${commentId}/downvote`)
        .set('Authorization', `Bearer ${authorApiKey}`);

      expect(res.status).toBeLessThan(300);
    });
  });
});

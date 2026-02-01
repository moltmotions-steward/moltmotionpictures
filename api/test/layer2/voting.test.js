const request = require('supertest');
const { getDb, teardown } = require('../layer1/config');
const app = require('../../src/app');

describe('Layer 2 - Voting Logic (Supertest)', () => {
    let db;
    let authorId;
    let voterId;
    let submoltId;
    let postId;

    function makeName(prefix, maxLen) {
        const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const normalized = `${prefix}_${suffix}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        return normalized.slice(0, maxLen);
    }

    beforeAll(() => {
        db = getDb();
    });

    afterAll(async () => {
        try {
            if (postId) {
                await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [postId, 'post']);
                await db.query('DELETE FROM posts WHERE id = $1', [postId]);
            }
            if (submoltId) {
                await db.query('DELETE FROM submolt_moderators WHERE submolt_id = $1', [submoltId]);
                await db.query('DELETE FROM subscriptions WHERE submolt_id = $1', [submoltId]);
                await db.query('DELETE FROM submolts WHERE id = $1', [submoltId]);
            }
            if (authorId) {
                await db.query('DELETE FROM agents WHERE id = $1', [authorId]);
            }
            if (voterId) {
                await db.query('DELETE FROM agents WHERE id = $1', [voterId]);
            }
        } finally {
            await teardown();
        }
    });

    it('supports upvote -> switch to downvote -> remove (score 0 -> 1 -> -1 -> 0)', async () => {
        const authorName = makeName('l2author', 32);
        const voterName = makeName('l2voter', 32);
        const submoltName = makeName('l2vote', 24);

        const authorRes = await request(app)
            .post('/api/v1/agents/register')
            .send({ name: authorName, description: 'Author' });
        expect(authorRes.status).toBe(201);
        authorId = authorRes.body.agent.id;
        const authorKey = authorRes.body.agent.api_key;

        const voterRes = await request(app)
            .post('/api/v1/agents/register')
            .send({ name: voterName, description: 'Voter' });
        expect(voterRes.status).toBe(201);
        voterId = voterRes.body.agent.id;
        const voterKey = voterRes.body.agent.api_key;

        const submoltRes = await request(app)
            .post('/api/v1/submolts')
            .set('Authorization', `Bearer ${authorKey}`)
            .send({ name: submoltName, description: 'Voting test topic' });
        expect(submoltRes.status).toBe(201);
        submoltId = submoltRes.body.submolt.id;

        const postRes = await request(app)
            .post('/api/v1/posts')
            .set('Authorization', `Bearer ${authorKey}`)
            .send({
                submolt: submoltName,
                title: 'Vote check',
                content: 'Please vote',
            });
        expect(postRes.status).toBe(201);
        postId = postRes.body.post.id;
        expect(postRes.body.post.score).toBe(0);

        const upvote = await request(app)
            .post(`/api/v1/posts/${postId}/upvote`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(upvote.status).toBe(200);
        expect(upvote.body.action).toBe('upvoted');

        const check1 = await request(app)
            .get(`/api/v1/posts/${postId}`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(check1.status).toBe(200);
        expect(check1.body.post.score).toBe(1);

        const downvote = await request(app)
            .post(`/api/v1/posts/${postId}/downvote`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(downvote.status).toBe(200);
        expect(downvote.body.action).toBe('changed');

        const check2 = await request(app)
            .get(`/api/v1/posts/${postId}`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(check2.status).toBe(200);
        expect(check2.body.post.score).toBe(-1);

        const remove = await request(app)
            .post(`/api/v1/posts/${postId}/downvote`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(remove.status).toBe(200);
        expect(remove.body.action).toBe('removed');

        const check3 = await request(app)
            .get(`/api/v1/posts/${postId}`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(check3.status).toBe(200);
        expect(check3.body.post.score).toBe(0);
    });
});

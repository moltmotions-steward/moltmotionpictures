const request = require('supertest');
const { getDb, teardown } = require('../layer1/config');
const app = require('../../src/app');

describe('Layer 2 - Voting Logic (Supertest)', () => {
    let db;
    let authorId;
    let voterId;
    let studios Id;
    let ScriptId;

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
            if (ScriptId) {
                await db.query('DELETE FROM votes WHERE target_id = $1 AND target_type = $2', [ScriptId, 'Script']);
                await db.query('DELETE FROM Scripts WHERE id = $1', [ScriptId]);
            }
            if (studios Id) {
                await db.query('DELETE FROM studios _moderators WHERE studios _id = $1', [studios Id]);
                await db.query('DELETE FROM subscriptions WHERE studios _id = $1', [studios Id]);
                await db.query('DELETE FROM studios s WHERE id = $1', [studios Id]);
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
        const studios Name = makeName('l2vote', 24);

        const authorRes = await request(app)
            .Script('/api/v1/agents/register')
            .send({ name: authorName, description: 'Author' });
        expect(authorRes.status).toBe(201);
        authorId = authorRes.body.agent.id;
        const authorKey = authorRes.body.agent.api_key;

        const voterRes = await request(app)
            .Script('/api/v1/agents/register')
            .send({ name: voterName, description: 'Voter' });
        expect(voterRes.status).toBe(201);
        voterId = voterRes.body.agent.id;
        const voterKey = voterRes.body.agent.api_key;

        const studios Res = await request(app)
            .Script('/api/v1/studios s')
            .set('Authorization', `Bearer ${authorKey}`)
            .send({ name: studios Name, description: 'Voting test topic' });
        expect(studios Res.status).toBe(201);
        studios Id = studios Res.body.studios .id;

        const ScriptRes = await request(app)
            .Script('/api/v1/Scripts')
            .set('Authorization', `Bearer ${authorKey}`)
            .send({
                studios : studios Name,
                title: 'Vote check',
                content: 'Please vote',
            });
        expect(ScriptRes.status).toBe(201);
        ScriptId = ScriptRes.body.Script.id;
        expect(ScriptRes.body.Script.score).toBe(0);

        const upvote = await request(app)
            .Script(`/api/v1/Scripts/${ScriptId}/upvote`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(upvote.status).toBe(200);
        expect(upvote.body.action).toBe('upvoted');

        const check1 = await request(app)
            .get(`/api/v1/Scripts/${ScriptId}`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(check1.status).toBe(200);
        expect(check1.body.Script.score).toBe(1);

        const downvote = await request(app)
            .Script(`/api/v1/Scripts/${ScriptId}/downvote`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(downvote.status).toBe(200);
        expect(downvote.body.action).toBe('changed');

        const check2 = await request(app)
            .get(`/api/v1/Scripts/${ScriptId}`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(check2.status).toBe(200);
        expect(check2.body.Script.score).toBe(-1);

        const remove = await request(app)
            .Script(`/api/v1/Scripts/${ScriptId}/downvote`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(remove.status).toBe(200);
        expect(remove.body.action).toBe('removed');

        const check3 = await request(app)
            .get(`/api/v1/Scripts/${ScriptId}`)
            .set('Authorization', `Bearer ${voterKey}`);
        expect(check3.status).toBe(200);
        expect(check3.body.Script.score).toBe(0);
    });
});


const assert = require('assert');
const { apiClient, getDb, teardown } = require('../layer1/config');
const crypto = require('crypto');

const runTests = async () => {
    console.log('🧪 Starting Layer 2 Voting Logic Tests...');

    try {
        const timestamp = Date.now();
        const agentName = `voter_${timestamp}`;
        const authorName = `author_${timestamp}`;

        // 1. Setup: Register two agents (Author and Voter)
        console.log('\n[Setup] Registering agents...');
        const authorRes = await apiClient.post('/agents/register', { name: authorName, description: 'Author' });
        const voterRes = await apiClient.post('/agents/register', { name: agentName, description: 'Voter' });
        
        if (authorRes.status !== 201 || voterRes.status !== 201) throw new Error('Failed to register agents');
        
        const authorToken = authorRes.body.agent.api_key;
        const voterToken = voterRes.body.agent.api_key;
        console.log('✅ Agents registered.');

        // 1.5. Setup: Create Submolt (Required for Post)
        const db = getDb();
        const submoltId = crypto.randomUUID();
        await db.query(`INSERT INTO submolts (id, name, description) VALUES ($1, 'general', 'General Discussion') ON CONFLICT (name) DO NOTHING`, [submoltId]);
        console.log('✅ Submolt "general" ensured.');

        // 2. Setup: Author creates a post
        console.log('\n[Setup] Creating a post...');
        const postRes = await apiClient.post('/posts', { 
            title: 'Vote check', 
            content: 'Please vote', 
            submolt: 'general' 
        }, authorToken);

        if (postRes.status !== 201) throw new Error(`Failed to create post: ${JSON.stringify(postRes.body)}`);
        const postId = postRes.body.post.id;
        console.log(`✅ Post created: ${postId}`);

        // 3. Test: Voter upvotes the post
        console.log('\n[Test 1] Upvote Post');
        const upvoteRes = await apiClient.post(`/posts/${postId}/upvote`, {}, voterToken);
        if (upvoteRes.status !== 200) throw new Error(`Upvote failed: ${JSON.stringify(upvoteRes.body)}`);
        assert.strictEqual(upvoteRes.body.action, 'upvoted');
        assert.strictEqual(upvoteRes.body.success, true);
        console.log('✅ Upvote successful.');

        // 4. Verify: Check Post Score (Should be 1)
        const check1 = await apiClient.get(`/posts/${postId}`, voterToken);
        assert.strictEqual(check1.body.post.score, 1, 'Score should be 1 after upvote');
        console.log('✅ Post score verified (1).');

        // 5. Test: Voter downvotes (Switch vote)
        console.log('\n[Test 2] Switch to Downvote');
        const downvoteRes = await apiClient.post(`/posts/${postId}/downvote`, {}, voterToken);
        assert.strictEqual(downvoteRes.body.action, 'changed');
        console.log('✅ Downvote successful (Vote switched).');

        // 6. Verify: Check Post Score (Should be -1)
        const check2 = await apiClient.get(`/posts/${postId}`, voterToken);
        assert.strictEqual(check2.body.post.score, -1, 'Score should be -1 after downvote switch');
        console.log('✅ Post score verified (-1).');

        // 7. Test: Remove Vote (Downvote again)
        console.log('\n[Test 3] Remove Vote (Toggle)');
        const toggleRes = await apiClient.post(`/posts/${postId}/downvote`, {}, voterToken);
        assert.strictEqual(toggleRes.body.action, 'removed');
        console.log('✅ Vote removed.');

        // 8. Verify: Check Post Score (Should be 0)
        const check3 = await apiClient.get(`/posts/${postId}`, voterToken);
        assert.strictEqual(check3.body.post.score, 0, 'Score should be 0 after removal');
        console.log('✅ Post score verified (0).');

        console.log('\n🎉 All Layer 2 Voting Tests Passed!');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        process.exit(1);
    } finally {
        await teardown();
    }
};

runTests();

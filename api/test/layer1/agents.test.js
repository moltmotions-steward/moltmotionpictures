const { config, teardown, apiClient } = require('./config');
const assert = require('assert');

// Test Suite: Agent Content (Layer 1)
// Goal: Verify profile updates and public profile fetching.

const TEST_AGENT_NAME = `content_agent_${Date.now()}`;
const UPDATE_DESC = 'Updated description for content test';
const UPDATE_DISPLAY = 'Content Tester';

async function runTests() {
  console.log('🧪 Starting Layer 1 Agent Content Tests...');
  const errors = [];
  let apiKey = '';

  try {
    // 1. Setup: Register Agent
    console.log(`\n[Setup] Registering ${TEST_AGENT_NAME}...`);
    const regRes = await apiClient.post('/agents/register', {
      name: TEST_AGENT_NAME,
      description: 'Initial description'
    });
    
    if (regRes.status !== 201) throw new Error('Registration failed');
    apiKey = regRes.body.agent.api_key;
    console.log('✅ Agent registered.');

    // 2. Test Profile Update
    console.log(`\n[Test 1] PATCH /agents/me`);
    const updateRes = await apiClient.patch('/agents/me', {
      description: UPDATE_DESC,
      displayName: UPDATE_DISPLAY
    }, apiKey);

    if (updateRes.status !== 200) {
      throw new Error(`Expected 200 OK, got ${updateRes.status}: ${JSON.stringify(updateRes.body)}`);
    }

    assert.strictEqual(updateRes.body.agent.description, UPDATE_DESC, 'Description should be updated');
    assert.strictEqual(updateRes.body.agent.display_name, UPDATE_DISPLAY, 'DisplayName should be updated');
    console.log('✅ Profile update verified.');

    // 3. Test Public Profile View
    console.log(`\n[Test 2] GET /agents/profile?name=${TEST_AGENT_NAME}`);
    const profileRes = await apiClient.get(`/agents/profile?name=${TEST_AGENT_NAME}`, apiKey);

    if (profileRes.status !== 200) {
      throw new Error(`Expected 200 OK, got ${profileRes.status}: ${JSON.stringify(profileRes.body)}`);
    }

    assert.strictEqual(profileRes.body.agent.description, UPDATE_DESC, 'Public profile should match updated description');
    assert.strictEqual(profileRes.body.agent.displayName, UPDATE_DISPLAY, 'Public profile should match updated display name');
    console.log('✅ Public profile fetch verified.');

  } catch (err) {
    console.error('❌ Test Failed:', err.message);
    errors.push(err);
  } finally {
    await teardown();
  }

  if (errors.length > 0) process.exit(1);
  console.log('\n🎉 All Layer 1 Agent Content Tests Passed!');
}

runTests();

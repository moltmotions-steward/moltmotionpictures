const { config, getDb, teardown, apiClient } = require('./config');
const assert = require('assert');

// Test Suite: Auth & Registration (Layer 1)
// Goal: Verify we can create an agent, persist it to DB, and authenticate with it.

const TEST_AGENT_NAME = `test_agent_${Date.now()}`;
const TEST_AGENT_DESC = 'Automated Layer 1 Test Agent';

async function runTests() {
  console.log('🧪 Starting Layer 1 Auth Tests...');
  const errors = [];
  let apiKey = '';

  try {
    // 1. Test Registration
    console.log(`\n[Test 1] POST /agents/register`);
    const regRes = await apiClient.post('/agents/register', {
      name: TEST_AGENT_NAME,
      description: TEST_AGENT_DESC
    });

    if (regRes.status !== 201) {
      throw new Error(`Expected 201 Created, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    }

    const agentData = regRes.body;
    assert.ok(agentData.agent && agentData.agent.api_key, 'Response should contain agent.api_key');
    assert.strictEqual(agentData.agent.name, TEST_AGENT_NAME, 'Name should match request');
    
    apiKey = agentData.agent.api_key;
    console.log('✅ Registration successful. Got API Key.');

    // 2. Verify Database Persistence (Side Effect Check)
    console.log(`\n[Test 2] Database Persistence Check`);
    const db = getDb();
    const dbResult = await db.query('SELECT * FROM agents WHERE name = $1', [TEST_AGENT_NAME]);
    
    assert.strictEqual(dbResult.rows.length, 1, 'Should find exactly 1 record in DB');
    assert.strictEqual(dbResult.rows[0].description, TEST_AGENT_DESC, 'DB Description should match');
    console.log('✅ Database record verified.');

    // 3. Verify Authentication (Login)
    console.log(`\n[Test 3] GET /agents/me (Authenticated)`);
    const meRes = await apiClient.get('/agents/me', apiKey);

    if (meRes.status !== 200) {
      throw new Error(`Expected 200 OK, got ${meRes.status}: ${JSON.stringify(meRes.body)}`);
    }

    assert.strictEqual(meRes.body.agent.name, TEST_AGENT_NAME, 'Authenticated agent name should match');
    console.log('✅ Authentication flow verified.');

    // 4. Verify Unauthorized Access
    console.log(`\n[Test 4] GET /agents/me (Unauthenticated)`);
    const failRes = await apiClient.get('/agents/me', null); // No token
    
    if (failRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${failRes.status}`);
    }
    console.log('✅ Unauthorized access rejected correctly.');

  } catch (err) {
    console.error('❌ Test Failed:', err.message);
    errors.push(err);
  } finally {
    await teardown();
  }

  if (errors.length > 0) process.exit(1);
  console.log('\n🎉 All Layer 1 Auth Tests Passed!');
}

runTests();

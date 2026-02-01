
const assert = require('assert');

const BASE_URL = process.env.TEST_WEB_URL || 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Layer 1 Web Client Smoke Tests...');
  console.log(`Target: ${BASE_URL}`);

  try {
    // Test 1: Homepage is accessible
    console.log('\n[Test 1] GET /');
    const start = Date.now();
    const res = await fetch(BASE_URL);
    const duration = Date.now() - start;
    
    if (!res.ok) {
      throw new Error(`Expected 200 OK, got ${res.status} ${res.statusText}`);
    }
    
    const html = await res.text();
    // Basic content check
    if (!html.includes('Moltbook') && !html.includes('moltbook')) {
       console.warn('⚠️ Warning: specific branding "Moltbook" not found in response, but 200 OK.');
    }
    
    console.log(`✅ Homepage loaded in ${duration}ms (Status: ${res.status})`);
    
    console.log('\n🎉 All Layer 1 Web Client Tests Passed!');
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();

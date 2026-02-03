const { TwitterApi } = require('twitter-api-v2');

// Load from environment
require('dotenv').config();

const client = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY,
  appSecret: process.env.X_CONSUMER_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

console.log('Testing with:');
console.log('  Consumer Key:', process.env.X_CONSUMER_KEY);
console.log('  Access Token:', process.env.X_ACCESS_TOKEN);

async function testAuth() {
  try {
    // Verify credentials
    const me = await client.v2.me();
    console.log('✅ Authentication successful!');
    console.log('User:', me.data.username);
    console.log('ID:', me.data.id);
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
    if (error.code) {
      console.error('Code:', error.code);
    }
  }
}

testAuth();

/**
 * Layer 3 Capacity Tests: API Load Testing
 * 
 * Measures throughput and latency for critical endpoints:
 * - POST /agents/register
 * - POST /posts (create)
 * - GET /posts (list)
 * - POST /votes/upvote
 * 
 * Run with: k6 run test/layer3/api-load.js
 * 
 * Expected numeric bounds (per Testing Doctrine):
 * - P95 latency: < 500ms for non-auth endpoints
 * - P95 latency: < 1000ms for write operations
 * - Throughput: > 100 req/sec per endpoint
 * - Error rate: < 1%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001/api/v1';

// Custom metrics
const errorRate = new Rate('errors');
const createPostDuration = new Trend('create_post_duration');
const listPostsDuration = new Trend('list_posts_duration');
const upvoteDuration = new Trend('upvote_duration');
const registerDuration = new Trend('register_duration');

function makeName(prefix, maxLen) {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const normalized = `${prefix}_${suffix}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return normalized.slice(0, maxLen);
}

function registerAgent(namePrefix) {
  const payload = JSON.stringify({
    name: makeName(namePrefix, 32),
    description: 'k6 load test agent',
  });

  const res = http.post(`${API_BASE_URL}/agents/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 201) {
    return null;
  }

  return {
    apiKey: res.json('agent.api_key'),
    agentId: res.json('agent.id'),
  };
}

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp to 50 users
    { duration: '2m', target: 100 },   // Ramp to 100 users (peak)
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    // Assert numeric bounds per Testing Doctrine
    'http_req_duration': ['p(95)<500'],        // 95th percentile < 500ms for general requests
    'http_req_failed': ['rate<0.01'],          // Error rate < 1%
    'create_post_duration': ['p(95)<1000'],    // Post creation < 1s
    'upvote_duration': ['p(95)<500'],          // Votes < 500ms
    'errors': ['rate<0.01'],                   // Custom error rate < 1%
  },
};

export function setup() {
  const setupAgent = registerAgent('l3_setup');
  if (!setupAgent) {
    console.error('Failed to create setup agent for load testing');
    return null;
  }

  const submoltName = makeName('l3sub', 24);
  const submoltRes = http.post(
    `${API_BASE_URL}/submolts`,
    JSON.stringify({ name: submoltName, description: 'k6 load test submolt' }),
    {
      headers: {
        'Authorization': `Bearer ${setupAgent.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (submoltRes.status !== 201) {
    console.error(`Failed to create submolt: status=${submoltRes.status} body=${submoltRes.body}`);
    return null;
  }

  // Create a seed post to use for vote/read tests.
  const seedPostRes = http.post(
    `${API_BASE_URL}/posts`,
    JSON.stringify({
      submolt: submoltName,
      title: 'Seed post for load tests',
      content: 'Seed content',
    }),
    {
      headers: {
        'Authorization': `Bearer ${setupAgent.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (seedPostRes.status !== 201) {
    console.error(`Failed to create seed post: status=${seedPostRes.status} body=${seedPostRes.body}`);
    return null;
  }

  return {
    setupApiKey: setupAgent.apiKey,
    submoltName,
    seedPostId: seedPostRes.json('post.id'),
  };
}

export default function (data) {
  if (!data) {
    console.error('Load test setup failed - no API key available');
    return;
  }

  const authHeaders = {
    'Authorization': `Bearer ${data.setupApiKey}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Register new agents (simulating traffic spike)
  group('Agent Registration', () => {
    const payload = JSON.stringify({
      name: makeName(`l3a_${__VU}_${__ITER}`, 32),
      description: 'Load test agent',
    });

    const res = http.post(`${API_BASE_URL}/agents/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const success = check(res, {
      'registration status 201': (r) => r.status === 201,
      'registration response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (!success) errorRate.add(1);
    registerDuration.add(res.timings.duration);
  });

  sleep(1);

  // Test 2: Create posts (write-heavy)
  group('Create Post', () => {
    // The API rate-limits posts per agent (1 post / 30m). Use a fresh agent for each create.
    const author = registerAgent('l3_post_author');
    if (!author) {
      errorRate.add(1);
      return;
    }

    const payload = JSON.stringify({
      submolt: data.submoltName,
      title: `Load test post VU ${__VU} ITER ${__ITER}`,
      content: `Load test post content from VU ${__VU}`,
    });

    const res = http.post(`${API_BASE_URL}/posts`, payload, {
      headers: {
        'Authorization': `Bearer ${author.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const success = check(res, {
      'create post status 201': (r) => r.status === 201,
      'create post response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (!success) errorRate.add(1);
    createPostDuration.add(res.timings.duration);
  });

  sleep(1);

  // Test 3: List posts (read-heavy)
  group('List Posts', () => {
    const res = http.get(`${API_BASE_URL}/submolts/${data.submoltName}/feed?limit=20&offset=0`, {
      headers: authHeaders,
    });

    const success = check(res, {
      'list posts status 200': (r) => r.status === 200,
      'list posts response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (!success) errorRate.add(1);
    listPostsDuration.add(res.timings.duration);
  });

  sleep(1);

  // Test 4: Upvote posts
  group('Upvote Post', () => {
    // Use a fresh voter each time to avoid vote toggles / repeats.
    const voter = registerAgent('l3_voter');
    if (!voter) {
      errorRate.add(1);
      return;
    }

    const res = http.post(`${API_BASE_URL}/posts/${data.seedPostId}/upvote`, JSON.stringify({}), {
      headers: {
        'Authorization': `Bearer ${voter.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const success = check(res, {
      'upvote status 200': (r) => r.status === 200,
      'upvote response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (!success) errorRate.add(1);
    upvoteDuration.add(res.timings.duration);
  });

  sleep(1);
}

export function teardown(data) {
  // Optional: cleanup created resources
  console.log('Load test completed');
}

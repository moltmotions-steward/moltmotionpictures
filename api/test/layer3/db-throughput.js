/**
 * Layer 3 Capacity Tests: Database Throughput
 * 
 * Measures database query performance under load:
 * - Agent registration (INSERT)
 * - Post creation (INSERT)
 * - Post retrieval (SELECT)
 * - Vote updates (UPDATE)
 * 
 * Expected numeric bounds:
 * - P95 INSERT latency: < 100ms
 * - P95 SELECT latency: < 50ms
 * - P95 UPDATE latency: < 100ms
 * - Sustained throughput: > 500 ops/sec across connection pool
 * 
 * Run with: k6 run test/layer3/db-throughput.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001/api/v1';

// Metrics
const insertLatency = new Trend('db_insert_latency');
const selectLatency = new Trend('db_select_latency');
const updateLatency = new Trend('db_update_latency');
const dbErrors = new Rate('db_errors');
const operationCount = new Counter('db_operations');

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // Warm up
    { duration: '2m', target: 50 },    // Sustain load
    { duration: '30s', target: 0 },    // Wind down
  ],
  thresholds: {
    'db_insert_latency': ['p(95)<100'],   // 95th percentile INSERT < 100ms
    'db_select_latency': ['p(95)<50'],    // 95th percentile SELECT < 50ms
    'db_update_latency': ['p(95)<100'],   // 95th percentile UPDATE < 100ms
    'db_errors': ['rate<0.01'],           // Error rate < 1%
  },
};

function makeName(prefix, maxLen) {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const normalized = `${prefix}_${suffix}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return normalized.slice(0, maxLen);
}

function registerAgent(prefix) {
  const payload = JSON.stringify({
    name: makeName(prefix, 32),
    description: 'k6 db throughput agent',
  });

  const res = http.post(`${API_BASE_URL}/agents/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 201) return null;

  return {
    apiKey: res.json('agent.api_key'),
    agentId: res.json('agent.id'),
  };
}

export function setup() {
  const setupAgent = registerAgent('l3_db_setup');
  if (!setupAgent) return null;

  const submoltName = makeName('l3dbsub', 24);
  const submoltRes = http.post(
    `${API_BASE_URL}/submolts`,
    JSON.stringify({ name: submoltName, description: 'k6 db throughput submolt' }),
    {
      headers: {
        'Authorization': `Bearer ${setupAgent.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (submoltRes.status !== 201) return null;

  // Seed one post for repeated read tests.
  const seedPostRes = http.post(
    `${API_BASE_URL}/posts`,
    JSON.stringify({
      submolt: submoltName,
      title: 'Seed post for db throughput',
      content: 'Seed content',
    }),
    {
      headers: {
        'Authorization': `Bearer ${setupAgent.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (seedPostRes.status !== 201) return null;

  return {
    setupApiKey: setupAgent.apiKey,
    submoltName,
    seedPostId: seedPostRes.json('post.id'),
  };
}

export default function (data) {
  if (!data) return;

  const headers = {
    'Authorization': `Bearer ${data.setupApiKey}`,
    'Content-Type': 'application/json',
  };

  // Test 1: INSERT - Agent Registration
  group('Database INSERT - Agent Registration', () => {
    const payload = JSON.stringify({
      name: makeName(`l3db_${__VU}_${__ITER}`, 32),
      description: 'Throughput test agent',
    });

    const startTime = Date.now();
    const res = http.post(`${API_BASE_URL}/agents/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'insert status 201': (r) => r.status === 201,
      'insert latency < 100ms': (r) => duration < 100,
    });

    if (!success) dbErrors.add(1);
    insertLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 2: INSERT - Post Creation
  group('Database INSERT - Post Creation', () => {
    // Respect per-agent post limits: register a fresh author for each post.
    const author = registerAgent('l3db_author');
    if (!author) {
      dbErrors.add(1);
      return;
    }

    const payload = JSON.stringify({
      submolt: data.submoltName,
      title: `DB throughput VU ${__VU} ITER ${__ITER}`,
      content: `DB throughput content - VU ${__VU} iteration ${__ITER}`,
    });

    const startTime = Date.now();
    const res = http.post(`${API_BASE_URL}/posts`, payload, {
      headers: {
        'Authorization': `Bearer ${author.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'post insert status 201': (r) => r.status === 201,
      'post insert latency < 100ms': (r) => duration < 100,
    });

    if (!success) dbErrors.add(1);
    insertLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 3: SELECT - Retrieve Posts
  group('Database SELECT - List Posts', () => {
    const startTime = Date.now();
    const res = http.get(`${API_BASE_URL}/submolts/${data.submoltName}/feed?limit=50&offset=0`, {
      headers,
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'select status 200': (r) => r.status === 200,
      'select latency < 50ms': (r) => duration < 50,
      'select has data': (r) => r.json('data') !== null,
    });

    if (!success) dbErrors.add(1);
    selectLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 4: UPDATE - Upvote (vote increment)
  group('Database UPDATE - Upvote Vote Count', () => {
    const voter = registerAgent('l3db_voter');
    if (!voter) {
      dbErrors.add(1);
      return;
    }

    const startTime = Date.now();
    const res = http.post(`${API_BASE_URL}/posts/${data.seedPostId}/upvote`, '{}', {
      headers: {
        'Authorization': `Bearer ${voter.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'update status 200': (r) => r.status === 200,
      'update latency < 100ms': (r) => duration < 100,
    });

    if (!success) dbErrors.add(1);
    updateLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 5: SELECT - Single Post (ID lookup)
  group('Database SELECT - Get Post by ID', () => {
    const startTime = Date.now();
    const res = http.get(`${API_BASE_URL}/posts/${data.seedPostId}`, {
      headers,
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'get post status 200': (r) => r.status === 200,
      'get post latency < 50ms': (r) => duration < 50,
    });

    if (!success) dbErrors.add(1);
    selectLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.5);
}

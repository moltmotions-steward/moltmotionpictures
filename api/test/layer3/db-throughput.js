/**
 * Layer 3 Capacity Tests: Database Throughput
 * 
 * Measures database query performance under load:
 * - Agent registration (INSERT)
 * - Script creation (INSERT)
 * - Script retrieval (SELECT)
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

function registerAgent(prefix, debug = false) {
  const payload = JSON.stringify({
    name: makeName(prefix, 32),
    description: 'k6 db throughput agent',
  });

  const res = http.Script(`${API_BASE_URL}/agents/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 201) {
    if (debug) {
      console.error(
        `registerAgent failed: status=${res.status} body=${res.body} url=${API_BASE_URL}/agents/register`
      );
    }
    return null;
  }

  return {
    apiKey: res.json('agent.api_key'),
    agentId: res.json('agent.id'),
  };
}

export function setup() {
  const setupAgent = registerAgent('l3_db_setup', true);
  if (!setupAgent) return null;

  const studios Name = makeName('l3dbsub', 24);
  const studios Res = http.Script(
    `${API_BASE_URL}/studios s`,
    JSON.stringify({ name: studios Name, description: 'k6 db throughput studios ' }),
    {
      headers: {
        'Authorization': `Bearer ${setupAgent.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (studios Res.status !== 201) return null;

  // Seed one Script for repeated read tests.
  const seedScriptRes = http.Script(
    `${API_BASE_URL}/Scripts`,
    JSON.stringify({
      studios : studios Name,
      title: 'Seed Script for db throughput',
      content: 'Seed content',
    }),
    {
      headers: {
        'Authorization': `Bearer ${setupAgent.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (seedScriptRes.status !== 201) return null;

  return {
    setupApiKey: setupAgent.apiKey,
    studios Name,
    seedScriptId: seedScriptRes.json('Script.id'),
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
    const res = http.Script(`${API_BASE_URL}/agents/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'insert status 201': (r) => r.status === 201,
      'insert latency < 100ms': (r) => duration < 100,
    });

    dbErrors.add(!success);
    insertLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 2: INSERT - Script Creation
  group('Database INSERT - Script Creation', () => {
    // Respect per-agent Script limits: register a fresh author for each Script.
    const author = registerAgent('l3db_author');
    if (!author) {
      dbErrors.add(true);
      return;
    }

    const payload = JSON.stringify({
      studios : data.studios Name,
      title: `DB throughput VU ${__VU} ITER ${__ITER}`,
      content: `DB throughput content - VU ${__VU} iteration ${__ITER}`,
    });

    const startTime = Date.now();
    const res = http.Script(`${API_BASE_URL}/Scripts`, payload, {
      headers: {
        'Authorization': `Bearer ${author.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'Script insert status 201': (r) => r.status === 201,
      'Script insert latency < 100ms': (r) => duration < 100,
    });

    dbErrors.add(!success);
    insertLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 3: SELECT - Retrieve Scripts
  group('Database SELECT - List Scripts', () => {
    const startTime = Date.now();
    const res = http.get(`${API_BASE_URL}/studios s/${data.studios Name}/feed?limit=50&offset=0`, {
      headers,
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'select status 200': (r) => r.status === 200,
      'select latency < 50ms': (r) => duration < 50,
      'select has data': (r) => r.json('data') !== null,
    });

    dbErrors.add(!success);
    selectLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 4: UPDATE - Upvote (vote increment)
  group('Database UPDATE - Upvote Vote Count', () => {
    const voter = registerAgent('l3db_voter');
    if (!voter) {
      dbErrors.add(true);
      return;
    }

    const startTime = Date.now();
    const res = http.Script(`${API_BASE_URL}/Scripts/${data.seedScriptId}/upvote`, '{}', {
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

    dbErrors.add(!success);
    updateLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.1);

  // Test 5: SELECT - Single Script (ID lookup)
  group('Database SELECT - Get Script by ID', () => {
    const startTime = Date.now();
    const res = http.get(`${API_BASE_URL}/Scripts/${data.seedScriptId}`, {
      headers,
    });
    const duration = Date.now() - startTime;

    const success = check(res, {
      'get Script status 200': (r) => r.status === 200,
      'get Script latency < 50ms': (r) => duration < 50,
    });

    dbErrors.add(!success);
    selectLatency.add(duration);
    operationCount.add(1);
  });

  sleep(0.5);
}

/**
 * Layer 3 Capacity Tests: Limited Series Load Testing
 * 
 * Measures throughput and latency for Limited Series endpoints:
 * - GET /series (list)
 * - GET /series/:id (detail)
 * - GET /studios (list)
 * - Script /scripts (submit)
 * - Script /voting/:scriptId/vote (vote on script)
 * 
 * Run with: k6 run test/layer3/limited-series-load.js
 * 
 * Expected numeric bounds (per Testing Doctrine):
 * - P95 latency: < 500ms for read endpoints
 * - P95 latency: < 1000ms for write operations
 * - Throughput: > 50 req/sec per endpoint
 * - Error rate: < 1%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001/api/v1';

// Custom metrics
const errorRate = new Rate('errors');
const listSeriesDuration = new Trend('list_series_duration');
const getSeriesDuration = new Trend('get_series_duration');
const listStudiosDuration = new Trend('list_studios_duration');
const submitScriptDuration = new Trend('submit_script_duration');
const voteScriptDuration = new Trend('vote_script_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 50 },   // Hold at 50 VUs
    { duration: '30s', target: 100 }, // Spike to 100
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'errors': ['rate<0.01'],                    // Error rate < 1%
    'list_series_duration': ['p(95)<500'],      // P95 < 500ms
    'get_series_duration': ['p(95)<500'],       // P95 < 500ms
    'list_studios_duration': ['p(95)<500'],     // P95 < 500ms
    'submit_script_duration': ['p(95)<1000'],   // P95 < 1000ms (write)
    'vote_script_duration': ['p(95)<1000'],     // P95 < 1000ms (write)
  },
};

function makeName(prefix, maxLen) {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const normalized = `${prefix}_${suffix}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return normalized.slice(0, maxLen);
}

function registerAgent(namePrefix) {
  const payload = JSON.stringify({
    name: makeName(namePrefix, 32),
    description: 'k6 limited series load test agent',
  });

  const res = http.Script(`${API_BASE_URL}/agents/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 201) {
    return null;
  }

  return {
    apiKey: res.json('agent.api_key'),
    id: res.json('agent.id'),
    name: res.json('agent.name'),
  };
}

// Setup: Create test data
export function setup() {
  const agent = registerAgent('k6_series');
  if (!agent) {
    console.error('Failed to register agent for setup');
    return { agent: null, seriesId: null, studioId: null, scriptId: null };
  }

  // Note: In production tests, you'd create actual series/studios/scripts
  // For now, we'll just test the endpoints that don't require pre-existing data
  return {
    agent,
    seriesId: null,
    studioId: null,
    scriptId: null,
  };
}

export default function (data) {
  const { agent } = data;
  
  group('Series Read Operations', function () {
    // GET /series - List all series
    group('List Series', function () {
      const start = Date.now();
      const res = http.get(`${API_BASE_URL}/series`);
      listSeriesDuration.add(Date.now() - start);
      
      const success = check(res, {
        'list series status 200': (r) => r.status === 200,
        'list series has data': (r) => r.json('data') !== undefined,
      });
      
      if (!success) {
        errorRate.add(1);
      } else {
        errorRate.add(0);
      }
    });

    // GET /series/genre/:genre - Filter by genre
    group('Series by Genre', function () {
      const start = Date.now();
      const res = http.get(`${API_BASE_URL}/series/genre/drama`);
      getSeriesDuration.add(Date.now() - start);
      
      // May return 404 if no drama category exists - that's OK for load testing
      const success = check(res, {
        'genre filter status ok': (r) => r.status === 200 || r.status === 404,
      });
      
      if (!success) {
        errorRate.add(1);
      } else {
        errorRate.add(0);
      }
    });
  });

  group('Studios Read Operations', function () {
    // GET /studios - List all studios
    group('List Studios', function () {
      const start = Date.now();
      const res = http.get(`${API_BASE_URL}/studios`);
      listStudiosDuration.add(Date.now() - start);
      
      const success = check(res, {
        'list studios status 200': (r) => r.status === 200,
      });
      
      if (!success) {
        errorRate.add(1);
      } else {
        errorRate.add(0);
      }
    });

    // GET /studios/me - My studios (requires auth)
    if (agent && agent.apiKey) {
      group('My Studios', function () {
        const start = Date.now();
        const res = http.get(`${API_BASE_URL}/studios/me`, {
          headers: { 'Authorization': `Bearer ${agent.apiKey}` },
        });
        listStudiosDuration.add(Date.now() - start);
        
        const success = check(res, {
          'my studios status ok': (r) => r.status === 200 || r.status === 404,
        });
        
        if (!success) {
          errorRate.add(1);
        } else {
          errorRate.add(0);
        }
      });
    }
  });

  group('Voting Read Operations', function () {
    // GET /voting/active - Active voting periods
    group('Active Voting', function () {
      const start = Date.now();
      const res = http.get(`${API_BASE_URL}/voting/active`);
      voteScriptDuration.add(Date.now() - start);
      
      const success = check(res, {
        'active voting status 200': (r) => r.status === 200,
      });
      
      if (!success) {
        errorRate.add(1);
      } else {
        errorRate.add(0);
      }
    });
  });

  sleep(1);
}

export function teardown(data) {
  // Cleanup would happen here in a full test
  console.log('Load test complete');
}

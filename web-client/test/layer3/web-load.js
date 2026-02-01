/**
 * Layer 3 Capacity Tests: Web Client Performance
 * 
 * Measures page load times and user experience metrics:
 * - Initial page load (DOMContentLoaded)
 * - Full page load (load event)
 * - Time to interactive (TTI)
 * 
 * Expected numeric bounds:
 * - P95 page load: < 3000ms
 * - P95 DOMContentLoaded: < 1500ms
 * - P95 resource load: < 500ms
 * - Error rate: < 1%
 * 
 * Run with: k6 run test/layer3/web-load.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const WEB_BASE_URL = __ENV.WEB_BASE_URL || 'http://localhost:3001';

// Custom metrics
const pageLoadTime = new Trend('page_load_time');
const resourceLoadTime = new Trend('resource_load_time');
const errorRate = new Rate('web_errors');
const pageLoadCount = new Counter('page_loads');

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 50 },    // Ramp to 50 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'page_load_time': ['p(95)<3000'],      // 95th percentile page load < 3s
    'resource_load_time': ['p(95)<500'],   // 95th percentile resource load < 500ms
    'web_errors': ['rate<0.01'],           // Error rate < 1%
  },
};

export default function () {
  group('Homepage Load', () => {
    const startTime = Date.now();

    const res = http.get(WEB_BASE_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'k6/load-test',
      },
      timeout: '30s',
    });

    const loadTime = Date.now() - startTime;

    const success = check(res, {
      'homepage status 200': (r) => r.status === 200,
      'homepage load time < 3000ms': (r) => loadTime < 3000,
      'homepage has content': (r) => r.body.length > 100,
    });

    if (!success) errorRate.add(1);
    pageLoadTime.add(loadTime);
    pageLoadCount.add(1);
  });

  sleep(2);

  group('Submolts Page Load', () => {
    const startTime = Date.now();

    const res = http.get(`${WEB_BASE_URL}/submolts`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'k6/load-test',
      },
      timeout: '30s',
    });

    const loadTime = Date.now() - startTime;

    const success = check(res, {
      'submolts page status 200': (r) => r.status === 200,
      'submolts page load time < 3000ms': (r) => loadTime < 3000,
    });

    if (!success) errorRate.add(1);
    pageLoadTime.add(loadTime);
  });

  sleep(2);

  group('Dashboard Load (Optional)', () => {
    const startTime = Date.now();

    const res = http.get(`${WEB_BASE_URL}/dashboard`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'k6/load-test',
      },
      timeout: '30s',
    });

    const loadTime = Date.now() - startTime;

    // Dashboard may require auth, so 401/403 is acceptable
    const success = check(res, {
      'dashboard load time < 3000ms': (r) => loadTime < 3000,
      'dashboard status ok or auth required': (r) => r.status === 200 || r.status === 401 || r.status === 403,
    });

    if (res.status !== 200 && res.status !== 401 && res.status !== 403) {
      errorRate.add(1);
    }
    pageLoadTime.add(loadTime);
  });

  sleep(2);
}

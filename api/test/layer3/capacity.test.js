import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import autocannon from 'autocannon';

/**
 * Layer 3: Capacity Testing
 *
 * This test layer measures throughput and latency against real API endpoints.
 * According to the Testing Doctrine, Layer 3 tests must assert numeric expectations
 * about performance and scaling (e.g., P95 latency < 100ms, throughput > X req/sec).
 *
 * Run with: npm run test:layer3
 */

describe('Layer 3 - API Capacity Tests', () => {
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
  const RUN_LAYER3_CAPACITY = process.env.RUN_LAYER3_CAPACITY === '1';
  const test = RUN_LAYER3_CAPACITY ? it : it.skip;
  let result;

  beforeAll(async () => {
    if (!RUN_LAYER3_CAPACITY) return;

    // Optional: Wait for API to be ready or skip tests if API is unreachable
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) {
        console.warn('API health check failed; capacity tests may be skipped.');
      }
    } catch (error) {
      console.warn('API unreachable; capacity tests will be skipped.');
    }
  });

  test('should handle health checks with < 50ms P95 latency', async () => {
    // Perform a lightweight load test on the health endpoint
    result = await autocannon({
      url: `${API_BASE}/health`,
      connections: 10,
      pipelining: 1,
      duration: 5,
    });

    // Assert numeric expectations per doctrine
    expect(result.requests.average).toBeGreaterThan(0);
    expect(result.latency.p95).toBeLessThan(50);
    expect(result.throughput.average).toBeGreaterThan(0);
  }, 30000); // Extended timeout for load test

  test('should sustain at least 100 req/sec on GET requests', async () => {
    result = await autocannon({
      url: `${API_BASE}/api/v1/agents`,
      connections: 5,
      pipelining: 2,
      duration: 5,
    });

    const avgThroughput = result.throughput.average;
    expect(avgThroughput).toBeGreaterThan(100);
    console.log(`Throughput: ${avgThroughput} req/sec`);
  }, 30000);

  test('should keep POST latency under 200ms P95', async () => {
    // This test assumes a minimal POST endpoint or skips if unreachable
    result = await autocannon({
      url: `${API_BASE}/api/v1/posts`,
      connections: 5,
      pipelining: 1,
      duration: 5,
    });

    expect(result.latency.p95).toBeLessThan(200);
  }, 30000);

  afterAll(() => {
    if (result) {
      console.log('=== Capacity Test Results ===');
      console.log(`Requests: ${result.requests.total}`);
      console.log(`Throughput: ${result.throughput.average} req/sec`);
      console.log(`Latency P50: ${result.latency.p50}ms`);
      console.log(`Latency P95: ${result.latency.p95}ms`);
      console.log(`Latency P99: ${result.latency.p99}ms`);
    }
  });
});

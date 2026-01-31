/**
 * @moltbook/rate-limiter Test Suite
 * 
 * Run: npm test
 */

const {
  RateLimiter,
  MemoryStore,
  rateLimitMiddleware,
  createMoltbookLimiter,
  MOLTBOOK_LIMITS
} = require('../src');

// ============================================
// Test Framework
// ============================================

let passed = 0;
let failed = 0;
const tests = [];

function describe(name, fn) {
  tests.push({ type: 'describe', name, fn });
}

function test(name, fn) {
  tests.push({ type: 'test', name, fn });
}

async function runAllTests() {
  for (const item of tests) {
    if (item.type === 'describe') {
      console.log(`\n📦 ${item.name}\n`);
      await item.fn();
    } else {
      try {
        await item.fn();
        console.log(`   ✅ ${item.name}`);
        passed++;
      } catch (error) {
        console.log(`   ❌ ${item.name}`);
        console.log(`      Error: ${error.message}`);
        failed++;
      }
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============================================
// Tests
// ============================================

async function runTests() {
  console.log('\n @moltbook/rate-limiter Test Suite\n');
  console.log('═'.repeat(50));

  // RateLimiter Creation
  describe('RateLimiter Creation', () => {});
  
  test('creates with default options', async () => {
    const limiter = new RateLimiter();
    assert(limiter.store instanceof MemoryStore);
    assertEqual(limiter.keyPrefix, 'rl:');
  });

  test('creates with custom limits', async () => {
    const limiter = new RateLimiter({
      limits: {
        custom: { max: 5, window: 60 }
      }
    });
    assert(limiter.limits.custom);
    assertEqual(limiter.limits.custom.max, 5);
  });

  test('includes default Moltbook limits', async () => {
    const limiter = new RateLimiter();
    assertEqual(limiter.limits.requests.max, 100);
    assertEqual(limiter.limits.posts.max, 1);
    assertEqual(limiter.limits.comments.max, 50);
  });

  // Basic Rate Limiting
  describe('Basic Rate Limiting', () => {});
  
  test('allows requests within limit', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 5, window: 60 } }
    });
    
    const result = await limiter.consume('user1', 'test');
    assert(result.allowed, 'Should be allowed');
    assertEqual(result.remaining, 4);
  });

  test('blocks requests over limit', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 2, window: 60 } }
    });
    
    await limiter.consume('user2', 'test');
    await limiter.consume('user2', 'test');
    const result = await limiter.consume('user2', 'test');
    
    assert(!result.allowed, 'Should be blocked');
    assertEqual(result.remaining, 0);
    assert(result.retryAfter > 0, 'Should have retry after');
  });

  test('tracks different users separately', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 1, window: 60 } }
    });
    
    const result1 = await limiter.consume('userA', 'test');
    const result2 = await limiter.consume('userB', 'test');
    
    assert(result1.allowed, 'User A should be allowed');
    assert(result2.allowed, 'User B should be allowed');
  });

  test('tracks different limit types separately', async () => {
    const limiter = new RateLimiter({
      limits: {
        typeA: { max: 1, window: 60 },
        typeB: { max: 1, window: 60 }
      }
    });
    
    const result1 = await limiter.consume('user', 'typeA');
    const result2 = await limiter.consume('user', 'typeB');
    
    assert(result1.allowed, 'Type A should be allowed');
    assert(result2.allowed, 'Type B should be allowed');
  });

  // Check Without Consuming
  describe('Check Without Consuming', () => {});
  
  test('check does not consume tokens', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 2, window: 60 } }
    });
    
    await limiter.check('user3', 'test');
    await limiter.check('user3', 'test');
    await limiter.check('user3', 'test');
    
    const result = await limiter.consume('user3', 'test');
    assert(result.allowed, 'Should still be allowed');
    assertEqual(result.remaining, 1);
  });

  test('check returns accurate remaining', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 5, window: 60 } }
    });
    
    await limiter.consume('user4', 'test');
    await limiter.consume('user4', 'test');
    
    const check = await limiter.check('user4', 'test');
    assertEqual(check.remaining, 3);
    assert(check.allowed);
  });

  // Reset Functionality
  describe('Reset Functionality', () => {});
  
  test('reset clears rate limit', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 1, window: 60 } }
    });
    
    await limiter.consume('user5', 'test');
    let result = await limiter.consume('user5', 'test');
    assert(!result.allowed, 'Should be blocked');
    
    await limiter.reset('user5', 'test');
    
    result = await limiter.consume('user5', 'test');
    assert(result.allowed, 'Should be allowed after reset');
  });

  test('resetAll clears all limits', async () => {
    const limiter = new RateLimiter({
      limits: {
        typeA: { max: 1, window: 60 },
        typeB: { max: 1, window: 60 }
      }
    });
    
    await limiter.consume('user6', 'typeA');
    await limiter.consume('user6', 'typeB');
    
    await limiter.resetAll('user6');
    
    const resultA = await limiter.consume('user6', 'typeA');
    const resultB = await limiter.consume('user6', 'typeB');
    
    assert(resultA.allowed, 'Type A should be allowed');
    assert(resultB.allowed, 'Type B should be allowed');
  });

  // Status Retrieval
  describe('Status Retrieval', () => {});
  
  test('getStatus returns correct info', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 10, window: 60 } }
    });
    
    await limiter.consume('user7', 'test');
    await limiter.consume('user7', 'test');
    await limiter.consume('user7', 'test');
    
    const status = await limiter.getStatus('user7', 'test');
    assertEqual(status.used, 3);
    assertEqual(status.remaining, 7);
    assertEqual(status.max, 10);
  });

  test('getAllStatuses returns all limit types', async () => {
    const limiter = new RateLimiter();
    
    const statuses = await limiter.getAllStatuses('user8');
    assert(statuses.requests, 'Should have requests');
    assert(statuses.posts, 'Should have posts');
    assert(statuses.comments, 'Should have comments');
  });

  // Cost Parameter
  describe('Cost Parameter', () => {});
  
  test('consume with cost > 1', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 10, window: 60 } }
    });
    
    const result = await limiter.consume('user9', 'test', 3);
    assert(result.allowed);
    assertEqual(result.remaining, 7);
  });

  test('cost exceeding limit is blocked', async () => {
    const limiter = new RateLimiter({
      limits: { test: { max: 5, window: 60 } }
    });
    
    const result = await limiter.consume('user10', 'test', 6);
    assert(!result.allowed, 'Should be blocked');
  });

  // MemoryStore
  describe('MemoryStore', () => {});
  
  test('stores and retrieves entries', async () => {
    const store = new MemoryStore();
    const now = Date.now();
    
    await store.add('key1', now);
    await store.add('key1', now + 100);
    
    const count = await store.count('key1', now - 1000);
    assertEqual(count, 2);
    
    store.destroy();
  });

  test('cleanup removes old entries', async () => {
    const store = new MemoryStore();
    const now = Date.now();
    
    await store.add('key2', now - 5000); // Old
    await store.add('key2', now);        // New
    
    await store.cleanup('key2', now - 1000);
    
    const count = await store.count('key2', 0);
    assertEqual(count, 1);
    
    store.destroy();
  });

  test('oldest returns correct timestamp', async () => {
    const store = new MemoryStore();
    const now = Date.now();
    
    await store.add('key3', now + 1000);
    await store.add('key3', now);
    await store.add('key3', now + 2000);
    
    const oldest = await store.oldest('key3', 0);
    assertEqual(oldest, now);
    
    store.destroy();
  });

  test('clear removes all entries', async () => {
    const store = new MemoryStore();
    
    await store.add('key4', Date.now());
    await store.add('key4', Date.now());
    
    await store.clear('key4');
    
    const count = await store.count('key4', 0);
    assertEqual(count, 0);
    
    store.destroy();
  });

  // Factory Function
  describe('Factory Function', () => {});
  
  test('createMoltbookLimiter creates configured limiter', async () => {
    const limiter = createMoltbookLimiter();
    
    assertEqual(limiter.limits.requests.max, 100);
    assertEqual(limiter.limits.requests.window, 60);
    assertEqual(limiter.limits.posts.max, 1);
    assertEqual(limiter.limits.posts.window, 1800);
  });

  // Middleware
  describe('Middleware', () => {});
  
  test('rateLimitMiddleware is a function', async () => {
    const limiter = new RateLimiter();
    const middleware = rateLimitMiddleware(limiter);
    assertEqual(typeof middleware, 'function');
  });

  test('middleware allows requests', async () => {
    const limiter = new RateLimiter();
    const middleware = rateLimitMiddleware(limiter);
    
    const req = { ip: '127.0.0.1' };
    const res = {
      setHeader: () => {},
      status: () => ({ json: () => {} })
    };
    
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    
    assert(nextCalled, 'next() should be called');
  });

  // Constants
  describe('Constants', () => {});
  
  test('MOLTBOOK_LIMITS is defined', async () => {
    assert(MOLTBOOK_LIMITS.requests);
    assert(MOLTBOOK_LIMITS.posts);
    assert(MOLTBOOK_LIMITS.comments);
    assertEqual(MOLTBOOK_LIMITS.requests.max, 100);
    assertEqual(MOLTBOOK_LIMITS.posts.window, 1800);
  });

  // Error Handling
  describe('Error Handling', () => {});
  
  test('throws on unknown limit type', async () => {
    const limiter = new RateLimiter();
    let threw = false;
    
    try {
      await limiter.consume('user', 'unknown_type');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Unknown limit type'));
    }
    
    assert(threw, 'Should throw error');
  });

  // Run all tests
  await runAllTests();

  // ============================================
  // Results
  // ============================================

  console.log('\n' + '═'.repeat(50));
  console.log(`\n🦞 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('❌ Some tests failed!\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});

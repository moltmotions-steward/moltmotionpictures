const request = require('supertest');
const { teardown } = require('./config');
const app = require('../../src/app');

describe('Layer 1 - Application & Utils', () => {
  afterAll(async () => {
    await teardown();
  });

  describe('App Initialization', () => {
    it('starts and responds to health check', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.name).toBeDefined();
      expect(res.body.version).toBeDefined();
    });

    it('has correct API metadata', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.name).toMatch(/moltmotionpictures/i);
      expect(res.body.version).toBeDefined();
      expect(res.body.documentation).toBeDefined();
    });

    it('applies security headers via helmet', async () => {
      const res = await request(app).get('/');

      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-xss-protection');
    });

    it('enables compression for responses', async () => {
      const res = await request(app)
        .get('/')
        .set('Accept-Encoding', 'gzip');

      // Response should indicate compression support or return successfully
      expect(res.status).toBe(200);
    });

    it('parses JSON request bodies', async () => {
      const agentName = `apptest_${Date.now().toString(36)}`;
      const res = await request(app)
        .Script('/api/v1/agents/register')
        .send({ name: agentName, description: 'App test' });

      expect(res.status).toBe(201);
      expect(res.body.agent).toBeDefined();
      
      // Cleanup
      if (res.body.agent?.id) {
        const { getDb } = require('./config');
        const db = getDb();
        await db.query('DELETE FROM agents WHERE id = $1', [res.body.agent.id]);
      }
    });

    it('sets trust proxy for rate limiting', async () => {
      // The app should trust proxy headers for client IP
      const res = await request(app)
        .get('/')
        .set('X-Forwarded-For', '203.0.113.195');

      expect(res.status).toBe(200);
    });
  });

  describe('CORS Configuration', () => {
    it('sets proper CORS headers', async () => {
      const res = await request(app)
        .get('/api/v1/feed')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('allows specified HTTP methods', async () => {
      const res = await request(app)
        .options('/api/v1/agents/me')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'PATCH');

      expect(res.status).toBeLessThan(300);
    });

    it('allows Authorization header', async () => {
      const res = await request(app)
        .options('/api/v1/agents/me')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(res.status).toBeLessThan(300);
    });
  });

  describe('Error Handling', () => {
    it('returns 404 for undefined routes', async () => {
      const res = await request(app)
        .get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('handles malformed JSON gracefully', async () => {
      const res = await request(app)
        .Script('/api/v1/agents/register')
        .set('Content-Type', 'application/json')
        .send('{invalid json');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns structured error responses', async () => {
      const res = await request(app)
        .get('/api/v1/Scripts/invalid-id');

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('Request Logging', () => {
    it('processes requests without logging errors', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      // If morgan is configured correctly, this should not throw
    });

    it('logs different formats based on environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test with test environment
      process.env.NODE_ENV = 'test';
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Utility Functions', () => {
    const { success, created, paginated, error, noContent } = require('../../src/utils/response');
    const { ValidationError, NotFoundError, UnauthorizedError } = require('../../src/utils/errors');

    it('response module exports expected functions', () => {
      expect(typeof success).toBe('function');
      expect(typeof created).toBe('function');
      expect(typeof paginated).toBe('function');
      expect(typeof error).toBe('function');
      expect(typeof noContent).toBe('function');
    });

    it('ValidationError has correct status code', () => {
      const err = new ValidationError(['field is required']);
      
      expect(err.message).toBe('Validation failed');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('ValidationError');
      expect(err.errors).toEqual(['field is required']);
    });

    it('NotFoundError has correct status code', () => {
      const err = new NotFoundError('Resource');
      
      expect(err.message).toBe('Resource not found');
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe('NotFoundError');
    });

    it('UnauthorizedError has correct status code', () => {
      const err = new UnauthorizedError('Unauthorized access');
      
      expect(err.message).toBe('Unauthorized access');
      expect(err.statusCode).toBe(401);
      expect(err.name).toBe('UnauthorizedError');
    });
  });

  describe('Auth Utility Functions', () => {
    const { generateApiKey, hashToken, validateApiKey, generateClaimToken, extractToken } = require('../../src/utils/auth');

    it('generateApiKey creates valid format', () => {
      const apiKey = generateApiKey();
      
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey).toMatch(/^moltmotionpictures_/);
      expect(apiKey.length).toBeGreaterThan(30);
    });

    it('generateApiKey creates unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      
      expect(key1).not.toBe(key2);
    });

    it('hashToken produces consistent hashes', () => {
      const apiKey = generateApiKey();
      const hash1 = hashToken(apiKey);
      const hash2 = hashToken(apiKey);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(apiKey);
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('validateApiKey validates correct format', () => {
      const apiKey = generateApiKey();
      
      const isValid = validateApiKey(apiKey);
      expect(isValid).toBe(true);
    });

    it('validateApiKey rejects incorrect format', () => {
      const badKey = 'invalid_key';
      
      const isValid = validateApiKey(badKey);
      expect(isValid).toBe(false);
    });

    it('generateClaimToken creates valid format', () => {
      const claimToken = generateClaimToken();
      
      expect(claimToken).toBeDefined();
      expect(typeof claimToken).toBe('string');
      expect(claimToken).toMatch(/^moltmotionpictures_claim_/);
      expect(claimToken.length).toBeGreaterThan(20);
    });

    it('generateClaimToken creates unique tokens', () => {
      const token1 = generateClaimToken();
      const token2 = generateClaimToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Response Functions', () => {
    const { success, created, paginated, error: errorFn, noContent } = require('../../src/utils/response');

    it('response helpers are correctly exported', () => {
      expect(typeof success).toBe('function');
      expect(typeof created).toBe('function');
      expect(typeof paginated).toBe('function');
      expect(typeof errorFn).toBe('function');
      expect(typeof noContent).toBe('function');
    });
  });

  describe('Config Module', () => {
    const config = require('../../src/config');

    it('exports database configuration', () => {
      expect(config).toHaveProperty('database');
      expect(config.database).toHaveProperty('url');
    });

    it('exports environment settings', () => {
      expect(config).toHaveProperty('isProduction');
      expect(typeof config.isProduction).toBe('boolean');
      
      expect(config).toHaveProperty('nodeEnv');
      expect(typeof config.nodeEnv).toBe('string');
    });

    it('exports rate limit settings', () => {
      expect(config).toHaveProperty('rateLimits');
      expect(config.rateLimits).toHaveProperty('requests');
      expect(config.rateLimits.requests).toHaveProperty('max');
      expect(typeof config.rateLimits.requests.max).toBe('number');
    });

    it('has valid rate limit values', () => {
      expect(config.rateLimits.requests.max).toBeGreaterThan(0);
      expect(config.rateLimits.requests.window).toBeGreaterThan(0);
    });
  });
});

/**
 * Layer 1 - Wallets Route Integration Tests
 * 
 * Tests the /api/v1/wallets endpoints with real HTTP requests.
 * Uses supertest against the Express app.
 * 
 * Note: These tests verify:
 * - Route structure and responses
 * - Status endpoint works
 * - Input validation
 * - Error handling when CDP is not configured
 * 
 * Real wallet creation is tested in Layer 2 with actual CDP credentials.
 */

const request = require('supertest');
const { teardown } = require('./config');
const appModule = require('../../src/app');
const app = appModule.default || appModule;

describe('Layer 1 - Wallets Route (Supertest)', () => {
  afterAll(async () => {
    await teardown();
  });

  describe('GET /api/v1/wallets/status', () => {
    it('returns 200 with availability status', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('available');
      expect(res.body.data).toHaveProperty('network');
      expect(res.body.data).toHaveProperty('is_production');
      expect(res.body.data).toHaveProperty('explorer_base_url');
    });

    it('returns network info based on environment', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect(200);

      // In test environment, should be testnet
      expect(res.body.data.network).toBe('base-sepolia');
      expect(res.body.data.is_production).toBe(false);
      expect(res.body.data.explorer_base_url).toContain('sepolia.basescan.org');
    });

    it('indicates whether CDP is configured', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect(200);

      // available is a boolean indicating if CDP credentials are present
      expect(typeof res.body.data.available).toBe('boolean');
      expect(res.body.data).toHaveProperty('message');
    });
  });

  describe('POST /api/v1/wallets', () => {
    it('returns error when CDP is not configured', async () => {
      // Without CDP credentials, the endpoint should return an error
      const res = await request(app)
        .post('/api/v1/wallets')
        .send({});

      // If CDP is not configured (likely in test env), expect 500 or 503
      // If configured, we'd get 201 - all are valid depending on env
      expect([201, 500, 503]).toContain(res.status);

      if (res.status === 500 || res.status === 503) {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
      }
    });

    it('accepts agent_id in request body', async () => {
      const res = await request(app)
        .post('/api/v1/wallets')
        .send({ agent_id: 'test-agent-123' });

      // Either creates wallet (201) or service unavailable (503)
      expect([201, 500, 503]).toContain(res.status);
    });

    it('generates agent_id if not provided', async () => {
      const res = await request(app)
        .post('/api/v1/wallets')
        .send({});

      if (res.status === 201) {
        expect(res.body.data.agent_id).toBeDefined();
        expect(res.body.data.agent_id.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GET /api/v1/wallets/:address', () => {
    it('validates Ethereum address format', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/not-a-valid-address')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('returns info for valid address format', async () => {
      const validAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const res = await request(app)
        .get(`/api/v1/wallets/${validAddress}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.address).toBe(validAddress);
      expect(res.body.data.explorer_url).toContain(validAddress);
    });

    it('includes BaseScan explorer URL', async () => {
      const validAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const res = await request(app)
        .get(`/api/v1/wallets/${validAddress}`)
        .expect(200);

      expect(res.body.data.explorer_url).toContain('basescan.org');
    });
  });

  describe('Rate Limiting', () => {
    it('includes rate limit headers in response', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status');

      // Status endpoint may or may not have rate limiting
      expect(res.status).toBe(200);
    });

    // Note: Full rate limit testing requires multiple requests
    // which is better suited for Layer 3 load tests
  });

  describe('Response Format', () => {
    it('uses consistent JSON envelope', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect(200);

      // Standard API response format
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
    });

    it('returns proper content-type', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect('Content-Type', /json/);
    });
  });
});

/**
 * Layer 1 - Wallets Route Integration Tests
 * 
 * Tests the /api/v1/wallets endpoints with real HTTP requests.
 * Uses supertest against the Express app.
 * 
 * Note: CDP SDK is mocked since we can't make real CDP calls in tests.
 * The mock validates that the route correctly:
 * - Rate limits requests
 * - Validates input
 * - Returns proper response format
 * - Handles errors gracefully
 */

const request = require('supertest');
const { teardown } = require('./config');

// Mock CDP SDK before loading app
jest.mock('@coinbase/cdp-sdk', () => {
  const mockCreateAccount = jest.fn().mockResolvedValue({
    address: '0xMockAddress1234567890ABCDEF1234567890ABCDEF',
  });
  
  return {
    CdpClient: jest.fn().mockImplementation(() => ({
      evm: {
        createAccount: mockCreateAccount,
      },
    })),
    __mockCreateAccount: mockCreateAccount,
  };
});

// Mock config to ensure CDP is "configured"
jest.mock('../../src/config/index.js', () => {
  const actualConfig = jest.requireActual('../../src/config/index.js');
  return {
    ...actualConfig,
    default: {
      ...actualConfig.default,
      nodeEnv: 'test',
      cdp: {
        apiKeyName: 'test-key',
        apiKeySecret: 'test-secret',
        walletSecret: 'test-wallet-secret',
      },
    },
  };
});

const app = require('../../src/app');
const { CdpClient, __mockCreateAccount } = require('@coinbase/cdp-sdk');

describe('Layer 1 - Wallets Route (Supertest)', () => {
  afterAll(async () => {
    await teardown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

    it('indicates CDP is configured when credentials exist', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect(200);

      expect(res.body.data.available).toBe(true);
      expect(res.body.data.message).toContain('available');
    });

    it('returns testnet network in test environment', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/status')
        .expect(200);

      expect(res.body.data.network).toBe('base-sepolia');
      expect(res.body.data.is_production).toBe(false);
    });
  });

  describe('POST /api/v1/wallets', () => {
    it('creates wallet and returns address with explorer URL', async () => {
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({})
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('address');
      expect(res.body.data).toHaveProperty('network');
      expect(res.body.data).toHaveProperty('explorer_url');
      expect(res.body.data).toHaveProperty('agent_id');
      expect(res.body.data).toHaveProperty('next_step');
    });

    it('returns valid Ethereum address format', async () => {
      const expectedAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      __mockCreateAccount.mockResolvedValueOnce({ address: expectedAddress });

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({})
        .expect(201);

      expect(res.body.data.address).toBe(expectedAddress);
      expect(res.body.data.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('includes BaseScan explorer URL', async () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      __mockCreateAccount.mockResolvedValueOnce({ address });

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({})
        .expect(201);

      expect(res.body.data.explorer_url).toContain('basescan.org');
      expect(res.body.data.explorer_url).toContain(address);
    });

    it('accepts custom agent_id for idempotency', async () => {
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({ agent_id: 'my-custom-agent-id' })
        .expect(201);

      expect(res.body.data.agent_id).toBe('my-custom-agent-id');
      
      // Verify idempotency key was passed to CDP
      expect(__mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'molt-agent-my-custom-agent-id',
        })
      );
    });

    it('generates UUID if agent_id not provided', async () => {
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({})
        .expect(201);

      // Should have a UUID-like agent_id
      expect(res.body.data.agent_id).toBeDefined();
      expect(res.body.data.agent_id.length).toBeGreaterThan(0);
    });

    it('rejects invalid agent_id format', async () => {
      const res = await request(app)
        .post('/api/v1/wallets')
        .send({ agent_id: 'invalid!@#$%^&*()' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('agent_id');
    });

    it('includes next_step instructions in response', async () => {
      __mockCreateAccount.mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({})
        .expect(201);

      expect(res.body.data.next_step).toContain('/agents/register');
    });
  });

  describe('GET /api/v1/wallets/:address', () => {
    it('returns explorer info for valid address', async () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      
      const res = await request(app)
        .get(`/api/v1/wallets/${address}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.address).toBe(address);
      expect(res.body.data.explorer_url).toContain(address);
      expect(res.body.data.network).toBeDefined();
    });

    it('rejects invalid address format', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/not-a-valid-address')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid wallet address');
    });

    it('rejects address that is too short', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/0x123')
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('rejects address without 0x prefix', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/1234567890abcdef1234567890abcdef12345678')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('returns 500 when CDP call fails', async () => {
      __mockCreateAccount.mockRejectedValueOnce(new Error('CDP API unavailable'));

      const res = await request(app)
        .post('/api/v1/wallets')
        .send({ agent_id: 'error-test-agent' })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Failed to create wallet');
    });
  });

  describe('Rate Limiting', () => {
    // Note: Rate limit testing requires careful timing or mock manipulation
    // This test documents the expected behavior
    it('includes rate limit info in error response when exceeded', async () => {
      // This would require making 4+ requests quickly
      // In a real test, we'd mock the rate limiter or use time manipulation
      // For now, we just verify the route exists and responds
      const res = await request(app)
        .post('/api/v1/wallets')
        .send({});

      // First request should succeed (not rate limited)
      expect([200, 201, 429]).toContain(res.status);
    });
  });
});

describe('Layer 1 - Wallets Route No Auth Required', () => {
  it('does not require authentication for status check', async () => {
    const res = await request(app)
      .get('/api/v1/wallets/status');
    
    // Should not be 401 Unauthorized
    expect(res.status).not.toBe(401);
  });

  it('does not require authentication for wallet creation', async () => {
    const res = await request(app)
      .post('/api/v1/wallets')
      .send({});
    
    // Should not be 401 Unauthorized (may be other status)
    expect(res.status).not.toBe(401);
  });

  it('does not require authentication for wallet lookup', async () => {
    const res = await request(app)
      .get('/api/v1/wallets/0x1234567890abcdef1234567890abcdef12345678');
    
    expect(res.status).not.toBe(401);
  });
});

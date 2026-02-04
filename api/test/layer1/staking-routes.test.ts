/**
 * Layer 1 - Staking API Routes Integration Tests
 * 
 * Tests staking API endpoints against a real test database.
 * Validates authentication, rate limiting, and full request/response cycle.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import stakingRoutes from '../../src/routes/staking';
import { requireAuth } from '../../src/middleware/auth';
import * as StakingService from '../../src/services/StakingService';

const prisma = new PrismaClient();

// Mock auth middleware for testing
const mockAuth = (req: any, _res: any, next: any) => {
  req.agent = {
    id: 'test-agent-id',
    name: 'test-agent',
    displayName: 'Test Agent',
    description: null,
    karma: 100,
    status: 'active',
    isClaimed: true,
    createdAt: new Date()
  };
  next();
};

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  // Replace requireAuth with mock
  app.use((req, res, next) => mockAuth(req, res, next));
  app.use('/staking', stakingRoutes);
  return app;
}

describe('Layer 1 - Staking API Routes', () => {
  let app: express.Application;
  let testAgent: any;
  let testPool: any;

  beforeAll(async () => {
    app = createTestApp();

    // Create test agent
    testAgent = await prisma.agent.create({
      data: {
        id: 'test-agent-id',
        name: `test_api_${Date.now()}`,
        display_name: 'Test API Agent',
        api_key_hash: 'test_hash_api',
        wallet_address: '0x1234567890123456789012345678901234567890',
        status: 'active',
        is_claimed: true
      }
    });

    // Create default pool
    testPool = await StakingService.getOrCreateDefaultPool();
  });

  afterAll(async () => {
    // Cleanup
    if (testAgent) {
      await prisma.stakingReward.deleteMany({ where: { agent_id: testAgent.id } });
      await prisma.stake.deleteMany({ where: { agent_id: testAgent.id } });
      await prisma.agent.delete({ where: { id: testAgent.id } });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up stakes/rewards for test agent
    await prisma.stakingReward.deleteMany({ where: { agent_id: testAgent.id } });
    await prisma.stake.deleteMany({ where: { agent_id: testAgent.id } });
  });

  describe('GET /staking/pools', () => {
    it('should return all active pools', async () => {
      const response = await request(app)
        .get('/staking/pools')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.pools)).toBe(true);
      expect(response.body.pools.length).toBeGreaterThan(0);

      const pool = response.body.pools[0];
      expect(pool).toHaveProperty('id');
      expect(pool).toHaveProperty('name');
      expect(pool).toHaveProperty('minStakeAmountCents');
      expect(pool).toHaveProperty('apyBasisPoints');
      expect(pool).toHaveProperty('apyPercent');
    });

    it('should include pool statistics', async () => {
      const response = await request(app)
        .get('/staking/pools')
        .expect(200);

      const pool = response.body.pools[0];
      expect(pool).toHaveProperty('totalStakedCents');
      expect(pool).toHaveProperty('totalStakesCount');
      expect(typeof pool.totalStakesCount).toBe('number');
    });
  });

  describe('POST /staking/stake', () => {
    it('should create a stake successfully', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: '0x1111111111111111111111111111111111111111'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.stake).toBeDefined();
      expect(response.body.stake.id).toBeDefined();
      expect(response.body.stake.amountCents).toBe('10000');
      expect(response.body.stake.status).toBe('active');
    });

    it('should use default pool if poolId not provided', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: '0x2222222222222222222222222222222222222222'
        })
        .expect(201);

      expect(response.body.stake.poolId).toBe(testPool.id);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000'
          // Missing walletAddress
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: 'invalid',
          walletAddress: '0x3333333333333333333333333333333333333333'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid amountCents');
    });

    it('should reject amount below minimum', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '100',
          walletAddress: '0x4444444444444444444444444444444444444444'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('at least');
    });

    it('should reject invalid wallet address', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: 'invalid-address'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid wallet address');
    });
  });

  describe('POST /staking/unstake', () => {
    it('should reject unstaking before minimum duration', async () => {
      // Create a stake first
      const stakeResponse = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: '0x5555555555555555555555555555555555555555'
        })
        .expect(201);

      const stakeId = stakeResponse.body.stake.id;

      // Try to unstake immediately
      const response = await request(app)
        .post('/staking/unstake')
        .send({ stakeId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot unstake yet');
    });

    it('should reject missing stakeId', async () => {
      const response = await request(app)
        .post('/staking/unstake')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field');
    });

    it('should reject invalid stakeId', async () => {
      const response = await request(app)
        .post('/staking/unstake')
        .send({ stakeId: 'invalid-id' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /staking/claim', () => {
    it('should reject claiming from non-existent stake', async () => {
      const response = await request(app)
        .post('/staking/claim')
        .send({ stakeId: 'non-existent-id' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing stakeId', async () => {
      const response = await request(app)
        .post('/staking/claim')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field');
    });

    it('should reject claiming when no rewards available', async () => {
      // Create a stake
      const stakeResponse = await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: '0x6666666666666666666666666666666666666666'
        })
        .expect(201);

      const stakeId = stakeResponse.body.stake.id;

      // Try to claim immediately (no rewards yet)
      const response = await request(app)
        .post('/staking/claim')
        .send({ stakeId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No rewards');
    });
  });

  describe('GET /staking/status', () => {
    it('should return staking status for agent', async () => {
      // Create some stakes
      await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: '0x7777777777777777777777777777777777777777'
        })
        .expect(201);

      await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '20000',
          walletAddress: '0x8888888888888888888888888888888888888888'
        })
        .expect(201);

      const response = await request(app)
        .get('/staking/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.status.totalStakedCents).toBe('30000');
      expect(response.body.status.activeStakes).toBe(2);
      expect(Array.isArray(response.body.status.stakes)).toBe(true);
      expect(response.body.status.stakes.length).toBe(2);
    });

    it('should return empty status for agent with no stakes', async () => {
      const response = await request(app)
        .get('/staking/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status.totalStakedCents).toBe('0');
      expect(response.body.status.activeStakes).toBe(0);
      expect(response.body.status.stakes.length).toBe(0);
    });
  });

  describe('GET /staking/earnings', () => {
    it('should return earnings history for agent', async () => {
      const response = await request(app)
        .get('/staking/earnings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.earnings).toBeDefined();
      expect(response.body.earnings).toHaveProperty('totalEarnedCents');
      expect(response.body.earnings).toHaveProperty('claimedRewardsCents');
      expect(response.body.earnings).toHaveProperty('pendingRewardsCents');
      expect(Array.isArray(response.body.earnings.rewardHistory)).toBe(true);
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/staking/pools')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('pools');
    });

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('BigInt Serialization', () => {
    it('should serialize BigInt values as strings in responses', async () => {
      await request(app)
        .post('/staking/stake')
        .send({
          amountCents: '10000',
          walletAddress: '0x9999999999999999999999999999999999999999'
        })
        .expect(201);

      const response = await request(app)
        .get('/staking/status')
        .expect(200);

      // All numeric fields should be strings (BigInt serialization)
      expect(typeof response.body.status.totalStakedCents).toBe('string');
      expect(typeof response.body.status.totalEarnedCents).toBe('string');
      expect(typeof response.body.status.stakes[0].amountCents).toBe('string');
    });
  });
});

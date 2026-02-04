/**
 * Layer 1 - Staking Service Integration Tests
 * 
 * Tests StakingService against a real test database.
 * Validates database operations, transactions, and service layer logic.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as StakingService from '../../src/services/StakingService';
import * as CDPWalletService from '../../src/services/CDPWalletService';

const prisma = new PrismaClient();

describe('Layer 1 - Staking Service Integration', () => {
  let testAgent: any;
  let testPool: any;

  beforeAll(async () => {
    // Create test agent
    testAgent = await prisma.agent.create({
      data: {
        name: `test_staking_${Date.now()}`,
        display_name: 'Test Staking Agent',
        api_key_hash: 'test_hash_staking',
        wallet_address: '0x1234567890123456789012345678901234567890',
        status: 'active',
        is_claimed: true
      }
    });
  });

  afterAll(async () => {
    // Cleanup: delete test data
    if (testAgent) {
      await prisma.stakingReward.deleteMany({ where: { agent_id: testAgent.id } });
      await prisma.stake.deleteMany({ where: { agent_id: testAgent.id } });
      await prisma.agent.delete({ where: { id: testAgent.id } });
    }
    if (testPool) {
      await prisma.stakingPool.delete({ where: { id: testPool.id } });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing stakes/rewards for test agent
    await prisma.stakingReward.deleteMany({ where: { agent_id: testAgent.id } });
    await prisma.stake.deleteMany({ where: { agent_id: testAgent.id } });
  });

  describe('Pool Management', () => {
    it('should create default staking pool if none exists', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();

      expect(pool).toBeDefined();
      expect(pool.is_default).toBe(true);
      expect(pool.is_active).toBe(true);
      expect(Number(pool.min_stake_amount_cents)).toBeGreaterThan(0);
      expect(pool.apy_basis_points).toBeGreaterThan(0);

      testPool = pool;
    });

    it('should return existing default pool on subsequent calls', async () => {
      const pool1 = await StakingService.getOrCreateDefaultPool();
      const pool2 = await StakingService.getOrCreateDefaultPool();

      expect(pool1.id).toBe(pool2.id);
    });

    it('should get all active pools', async () => {
      const pools = await StakingService.getActivePools();

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
      pools.forEach(pool => {
        expect(pool.is_active).toBe(true);
      });
    });

    it('should get pool by ID', async () => {
      const defaultPool = await StakingService.getOrCreateDefaultPool();
      const pool = await StakingService.getPoolById(defaultPool.id);

      expect(pool).toBeDefined();
      expect(pool!.id).toBe(defaultPool.id);
    });
  });

  describe('Staking Operations', () => {
    it('should create a stake successfully', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      const amountCents = BigInt(10000); // $100

      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents,
        walletAddress: '0x1111111111111111111111111111111111111111'
      });

      expect(stake).toBeDefined();
      expect(stake.agent_id).toBe(testAgent.id);
      expect(stake.pool_id).toBe(pool.id);
      expect(stake.amount_cents).toBe(amountCents);
      expect(stake.status).toBe('active');
      expect(stake.can_unstake_at).toBeDefined();
      expect(stake.can_unstake_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject stake below minimum amount', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      const amountCents = BigInt(100); // $1 (below minimum)

      await expect(
        StakingService.stake({
          agentId: testAgent.id,
          poolId: pool.id,
          amountCents,
          walletAddress: '0x1111111111111111111111111111111111111111'
        })
      ).rejects.toThrow('at least');
    });

    it('should reject stake with invalid wallet address', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();

      await expect(
        StakingService.stake({
          agentId: testAgent.id,
          poolId: pool.id,
          amountCents: BigInt(10000),
          walletAddress: 'invalid-address'
        })
      ).rejects.toThrow('Invalid wallet address');
    });

    it('should update pool statistics after staking', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      const initialStaked = pool.total_staked_cents;
      const initialCount = pool.total_stakes_count;

      await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(10000),
        walletAddress: '0x2222222222222222222222222222222222222222'
      });

      const updatedPool = await StakingService.getPoolById(pool.id);
      expect(updatedPool!.total_staked_cents).toBe(initialStaked + BigInt(10000));
      expect(updatedPool!.total_stakes_count).toBe(initialCount + 1);
    });
  });

  describe('Unstaking Operations', () => {
    it('should reject unstaking before minimum duration', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(10000),
        walletAddress: '0x3333333333333333333333333333333333333333'
      });

      // Try to unstake immediately (should fail due to MEV protection)
      await expect(
        StakingService.unstake({
          stakeId: stake.id,
          agentId: testAgent.id
        })
      ).rejects.toThrow('Cannot unstake yet');
    });

    it('should allow unstaking after minimum duration (mocked)', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(10000),
        walletAddress: '0x4444444444444444444444444444444444444444'
      });

      // Manually update can_unstake_at to past time to simulate duration passing
      await prisma.stake.update({
        where: { id: stake.id },
        data: { can_unstake_at: new Date(Date.now() - 1000) }
      });

      const unstakedStake = await StakingService.unstake({
        stakeId: stake.id,
        agentId: testAgent.id
      });

      expect(unstakedStake.status).toBe('unstaked');
      expect(unstakedStake.unstaked_at).toBeDefined();
    });

    it('should reject unstaking by wrong agent', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(10000),
        walletAddress: '0x5555555555555555555555555555555555555555'
      });

      await expect(
        StakingService.unstake({
          stakeId: stake.id,
          agentId: 'wrong-agent-id'
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('should update pool statistics after unstaking', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(10000),
        walletAddress: '0x6666666666666666666666666666666666666666'
      });

      const poolBeforeUnstake = await StakingService.getPoolById(pool.id);

      // Mock time passing
      await prisma.stake.update({
        where: { id: stake.id },
        data: { can_unstake_at: new Date(Date.now() - 1000) }
      });

      await StakingService.unstake({
        stakeId: stake.id,
        agentId: testAgent.id
      });

      const poolAfterUnstake = await StakingService.getPoolById(pool.id);
      expect(poolAfterUnstake!.total_staked_cents).toBe(
        poolBeforeUnstake!.total_staked_cents - BigInt(10000)
      );
      expect(poolAfterUnstake!.total_stakes_count).toBe(
        poolBeforeUnstake!.total_stakes_count - 1
      );
    });
  });

  describe('Reward Calculation', () => {
    it('should calculate rewards for active stake', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(100000), // $1000
        walletAddress: '0x7777777777777777777777777777777777777777'
      });

      // Update last_reward_calc_at to 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      await prisma.stake.update({
        where: { id: stake.id },
        data: { last_reward_calc_at: twoHoursAgo }
      });

      await StakingService.calculateRewards(stake.id);

      const updatedStake = await prisma.stake.findUnique({
        where: { id: stake.id }
      });

      // Should have some rewards after 2 hours
      expect(Number(updatedStake!.earned_rewards_cents)).toBeGreaterThan(0);
    });

    it('should not calculate rewards if time threshold not met', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(100000),
        walletAddress: '0x8888888888888888888888888888888888888888'
      });

      const initialRewards = stake.earned_rewards_cents;

      // Try to calculate immediately (should skip)
      await StakingService.calculateRewards(stake.id);

      const updatedStake = await prisma.stake.findUnique({
        where: { id: stake.id }
      });

      expect(updatedStake!.earned_rewards_cents).toBe(initialRewards);
    });
  });

  describe('Status and Earnings Queries', () => {
    it('should get staking status for agent', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      // Create multiple stakes
      await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(10000),
        walletAddress: '0x9999999999999999999999999999999999999999'
      });

      await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(20000),
        walletAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      });

      const status = await StakingService.getStakingStatus(testAgent.id);

      expect(status).toBeDefined();
      expect(Number(status.totalStakedCents)).toBe(30000);
      expect(status.activeStakes).toBe(2);
      expect(Array.isArray(status.stakes)).toBe(true);
      expect(status.stakes.length).toBe(2);
    });

    it('should get staking earnings for agent', async () => {
      const pool = await StakingService.getOrCreateDefaultPool();
      
      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: pool.id,
        amountCents: BigInt(100000),
        walletAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
      });

      // Force reward calculation
      await prisma.stake.update({
        where: { id: stake.id },
        data: { last_reward_calc_at: new Date(Date.now() - 2 * 3600 * 1000) }
      });
      await StakingService.calculateRewards(stake.id);

      const earnings = await StakingService.getStakingEarnings(testAgent.id);

      expect(earnings).toBeDefined();
      expect(Number(earnings.totalEarnedCents)).toBeGreaterThan(0);
      expect(Array.isArray(earnings.rewardHistory)).toBe(true);
    });
  });

  describe('Wallet Address Validation', () => {
    it('should validate Ethereum addresses using CDPWalletService', () => {
      const validAddresses = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
      ];

      validAddresses.forEach(addr => {
        expect(CDPWalletService.isValidAddress(addr)).toBe(true);
      });

      const invalidAddresses = [
        'invalid',
        '0x123',
        ''
      ];

      invalidAddresses.forEach(addr => {
        expect(CDPWalletService.isValidAddress(addr)).toBe(false);
      });
    });
  });
});

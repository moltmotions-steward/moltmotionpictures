/**
 * Layer 1 - Staking Security Tests
 * 
 * Comprehensive security tests for wallet signature verification system.
 * Tests replay attacks, concurrent operations, rate limiting, and signature validation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import * as StakingService from '../../src/services/StakingService';
import * as WalletSignatureService from '../../src/services/WalletSignatureService';

const prisma = new PrismaClient();

describe('Layer 1 - Staking Security Tests', () => {
  let testAgent: any;
  let testPool: any;
  let testWallet: ethers.Wallet;
  let testWalletAddress: string;

  beforeAll(async () => {
    // Create test wallet
    testWallet = ethers.Wallet.createRandom();
    testWalletAddress = testWallet.address;

    // Create test agent with wallet
    testAgent = await prisma.agent.create({
      data: {
        name: `test_security_${Date.now()}`,
        display_name: 'Test Security Agent',
        api_key_hash: 'test_hash_security',
        wallet_address: testWalletAddress,
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
      await prisma.walletNonce.deleteMany({ where: { subject_id: testAgent.id } });
      await prisma.stakingReward.deleteMany({ where: { agent_id: testAgent.id } });
      await prisma.stake.deleteMany({ where: { agent_id: testAgent.id } });
      await prisma.agent.delete({ where: { id: testAgent.id } });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up nonces, stakes, and rewards
    await prisma.walletNonce.deleteMany({ where: { subject_id: testAgent.id } });
    await prisma.stakingReward.deleteMany({ where: { agent_id: testAgent.id } });
    await prisma.stake.deleteMany({ where: { agent_id: testAgent.id } });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature from agent wallet', async () => {
      // Generate nonce
      const nonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      // Create message
      const message = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce.nonce,
        issuedAt: nonce.issued_at.toISOString(),
        expiresAt: nonce.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign = WalletSignatureService.formatMessageForSigning(message);

      // Sign message
      const signature = await testWallet.signMessage(messageToSign);

      // Verify signature
      const isValid = await WalletSignatureService.verifySignature(
        message,
        signature,
        testWalletAddress
      );

      expect(isValid).toBe(true);
    });

    it('should reject signature from wrong wallet', async () => {
      // Create a different wallet
      const wrongWallet = ethers.Wallet.createRandom();

      // Generate nonce
      const nonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      // Create message
      const message = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce.nonce,
        issuedAt: nonce.issued_at.toISOString(),
        expiresAt: nonce.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign = WalletSignatureService.formatMessageForSigning(message);

      // Sign with wrong wallet
      const signature = await wrongWallet.signMessage(messageToSign);

      // Verify signature should fail
      await expect(
        WalletSignatureService.verifySignature(message, signature, testWalletAddress)
      ).rejects.toThrow('Signature verification failed');
    });

    it('should reject signature with tampered message', async () => {
      // Generate nonce
      const nonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      // Create original message
      const originalMessage = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce.nonce,
        issuedAt: nonce.issued_at.toISOString(),
        expiresAt: nonce.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign = WalletSignatureService.formatMessageForSigning(originalMessage);

      // Sign original message
      const signature = await testWallet.signMessage(messageToSign);

      // Tamper with message (change operation)
      const tamperedMessage = { ...originalMessage, operation: 'unstake' };

      // Verify with tampered message should fail
      await expect(
        WalletSignatureService.verifySignature(tamperedMessage, signature, testWalletAddress)
      ).rejects.toThrow('Signature verification failed');
    });

    it('should reject invalid signature format', async () => {
      const message = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: 'test-nonce',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const invalidSignature = '0xinvalidsignature';

      await expect(
        WalletSignatureService.verifySignature(message, invalidSignature, testWalletAddress)
      ).rejects.toThrow();
    });
  });

  describe('Replay Attack Protection', () => {
    it('should reject reused nonce (replay attack)', async () => {
      // Generate nonce
      const nonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      // Create message
      const message = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce.nonce,
        issuedAt: nonce.issued_at.toISOString(),
        expiresAt: nonce.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign = WalletSignatureService.formatMessageForSigning(message);
      const signature = await testWallet.signMessage(messageToSign);

      // First use - should succeed
      const isValid1 = await WalletSignatureService.verifySignature(
        message,
        signature,
        testWalletAddress
      );
      expect(isValid1).toBe(true);

      // Second use - should fail (nonce consumed)
      await expect(
        WalletSignatureService.verifySignature(message, signature, testWalletAddress)
      ).rejects.toThrow('Nonce not found, already consumed, or expired');
    });

    it('should reject expired nonce', async () => {
      // Create nonce directly in DB with past expiration
      const expiredNonce = await prisma.walletNonce.create({
        data: {
          subject_type: 'agent',
          subject_id: testAgent.id,
          wallet_address: testWalletAddress,
          nonce: 'expired-' + Math.random().toString(36),
          issued_at: new Date(Date.now() - 360000), // 6 minutes ago
          expires_at: new Date(Date.now() - 60000), // 1 minute ago (expired)
          consumed_at: null
        }
      });

      const message = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: expiredNonce.nonce,
        issuedAt: expiredNonce.issued_at.toISOString(),
        expiresAt: expiredNonce.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign = WalletSignatureService.formatMessageForSigning(message);
      const signature = await testWallet.signMessage(messageToSign);

      await expect(
        WalletSignatureService.verifySignature(message, signature, testWalletAddress)
      ).rejects.toThrow('Nonce not found, already consumed, or expired');
    });

    it('should reject nonce from different subject', async () => {
      // Create another agent
      const otherAgent = await prisma.agent.create({
        data: {
          name: `test_other_${Date.now()}`,
          display_name: 'Other Agent',
          api_key_hash: 'test_hash_other',
          wallet_address: ethers.Wallet.createRandom().address,
          status: 'active',
          is_claimed: true
        }
      });

      try {
        // Generate nonce for OTHER agent
        const nonce = await WalletSignatureService.generateNonce(
          'agent',
          otherAgent.id,
          testWalletAddress,
          'stake'
        );

        // Try to use it with TEST agent (subject mismatch)
        const message = {
          domain: 'molt.studio',
          subjectType: 'agent' as const,
          subjectId: testAgent.id, // Using test agent ID, not other agent
          walletAddress: testWalletAddress,
          nonce: nonce.nonce,
          issuedAt: nonce.issued_at.toISOString(),
          expiresAt: nonce.expires_at.toISOString(),
          operation: 'stake',
          chainId: 1
        };

        const messageToSign = WalletSignatureService.formatMessageForSigning(message);
        const signature = await testWallet.signMessage(messageToSign);

        await expect(
          WalletSignatureService.verifySignature(message, signature, testWalletAddress)
        ).rejects.toThrow('Nonce not found, already consumed, or expired');
      } finally {
        // Cleanup
        await prisma.walletNonce.deleteMany({ where: { subject_id: otherAgent.id } });
        await prisma.agent.delete({ where: { id: otherAgent.id } });
      }
    });

    it('should allow multiple valid nonces simultaneously', async () => {
      // Generate multiple nonces for different operations
      const nonce1 = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      const nonce2 = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'unstake'
      );

      expect(nonce1.nonce).not.toBe(nonce2.nonce);

      // Both should be valid
      const message1 = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce1.nonce,
        issuedAt: nonce1.issued_at.toISOString(),
        expiresAt: nonce1.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const message2 = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce2.nonce,
        issuedAt: nonce2.issued_at.toISOString(),
        expiresAt: nonce2.expires_at.toISOString(),
        operation: 'unstake',
        chainId: 1
      };

      const messageToSign1 = WalletSignatureService.formatMessageForSigning(message1);
      const messageToSign2 = WalletSignatureService.formatMessageForSigning(message2);

      const signature1 = await testWallet.signMessage(messageToSign1);
      const signature2 = await testWallet.signMessage(messageToSign2);

      const isValid1 = await WalletSignatureService.verifySignature(
        message1,
        signature1,
        testWalletAddress
      );
      const isValid2 = await WalletSignatureService.verifySignature(
        message2,
        signature2,
        testWalletAddress
      );

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });

  describe('Wallet Ownership Verification', () => {
    it('should verify agent owns the wallet', async () => {
      const isOwner = await WalletSignatureService.verifyAgentWalletOwnership(
        testAgent.id,
        testWalletAddress
      );

      expect(isOwner).toBe(true);
    });

    it('should reject wallet not owned by agent', async () => {
      const wrongWalletAddress = ethers.Wallet.createRandom().address;

      const isOwner = await WalletSignatureService.verifyAgentWalletOwnership(
        testAgent.id,
        wrongWalletAddress
      );

      expect(isOwner).toBe(false);
    });

    it('should reject nonexistent agent', async () => {
      const isOwner = await WalletSignatureService.verifyAgentWalletOwnership(
        'nonexistent-agent-id',
        testWalletAddress
      );

      expect(isOwner).toBe(false);
    });
  });

  describe('Concurrent Operations (Race Conditions)', () => {
    it('should handle concurrent stake operations safely', async () => {
      const amountCents = BigInt(10000); // $100

      // Create multiple nonces
      const nonces = await Promise.all([
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'stake'),
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'stake'),
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'stake')
      ]);

      // Create signatures for all nonces
      const stakePromises = nonces.map(async (nonce) => {
        const message = {
          domain: 'molt.studio',
          subjectType: 'agent' as const,
          subjectId: testAgent.id,
          walletAddress: testWalletAddress,
          nonce: nonce.nonce,
          issuedAt: nonce.issued_at.toISOString(),
          expiresAt: nonce.expires_at.toISOString(),
          operation: 'stake',
          chainId: 1
        };

        const messageToSign = WalletSignatureService.formatMessageForSigning(message);
        const signature = await testWallet.signMessage(messageToSign);

        return StakingService.stake({
          agentId: testAgent.id,
          poolId: testPool.id,
          amountCents,
          walletAddress: testWalletAddress,
          signature,
          message
        });
      });

      // Execute all stakes concurrently
      const results = await Promise.all(stakePromises);

      // All should succeed with different stake IDs
      expect(results).toHaveLength(3);
      results.forEach((stake, index) => {
        expect(stake.id).toBeDefined();
        expect(stake.agent_id).toBe(testAgent.id);
        expect(stake.amount_cents).toBe(amountCents);
      });

      // Verify all stakes are in database
      const allStakes = await prisma.stake.findMany({
        where: { agent_id: testAgent.id }
      });
      expect(allStakes).toHaveLength(3);
    });

    it('should prevent double-claim with concurrent requests', async () => {
      // Create a stake first
      const nonce1 = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      const message1 = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce1.nonce,
        issuedAt: nonce1.issued_at.toISOString(),
        expiresAt: nonce1.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign1 = WalletSignatureService.formatMessageForSigning(message1);
      const signature1 = await testWallet.signMessage(messageToSign1);

      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: testPool.id,
        amountCents: BigInt(10000),
        walletAddress: testWalletAddress,
        signature: signature1,
        message: message1
      });

      // Manually create a reward (simulating accrued rewards)
      await prisma.stakingReward.create({
        data: {
          stake_id: stake.id,
          agent_id: testAgent.id,
          pool_id: testPool.id,
          amount_cents: BigInt(500),
          calculated_at: new Date(),
          is_claimed: false
        }
      });

      // Generate two nonces for claim operations
      const claimNonces = await Promise.all([
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'claim'),
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'claim')
      ]);

      // Try to claim simultaneously
      const claimPromises = claimNonces.map(async (nonce) => {
        const message = {
          domain: 'molt.studio',
          subjectType: 'agent' as const,
          subjectId: testAgent.id,
          walletAddress: testWalletAddress,
          nonce: nonce.nonce,
          issuedAt: nonce.issued_at.toISOString(),
          expiresAt: nonce.expires_at.toISOString(),
          operation: 'claim',
          chainId: 1
        };

        const messageToSign = WalletSignatureService.formatMessageForSigning(message);
        const signature = await testWallet.signMessage(messageToSign);

        try {
          return await StakingService.claimRewards({
            stakeId: stake.id,
            agentId: testAgent.id,
            signature,
            message
          });
        } catch (error: any) {
          return { error: error.message };
        }
      });

      const results = await Promise.all(claimPromises);

      // One should succeed, one should fail (no unclaimed rewards)
      const successes = results.filter((r) => !('error' in r));
      const failures = results.filter((r) => 'error' in r);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error).toContain('No unclaimed rewards');
    });

    it('should handle concurrent unstake attempts safely', async () => {
      // Create a stake
      const nonce1 = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      const message1 = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: nonce1.nonce,
        issuedAt: nonce1.issued_at.toISOString(),
        expiresAt: nonce1.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const messageToSign1 = WalletSignatureService.formatMessageForSigning(message1);
      const signature1 = await testWallet.signMessage(messageToSign1);

      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: testPool.id,
        amountCents: BigInt(10000),
        walletAddress: testWalletAddress,
        signature: signature1,
        message: message1
      });

      // Manually update can_unstake_at to allow immediate unstaking
      await prisma.stake.update({
        where: { id: stake.id },
        data: { can_unstake_at: new Date(Date.now() - 1000) }
      });

      // Generate two nonces for unstake
      const unstakeNonces = await Promise.all([
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'unstake'),
        WalletSignatureService.generateNonce('agent', testAgent.id, testWalletAddress, 'unstake')
      ]);

      // Try to unstake simultaneously
      const unstakePromises = unstakeNonces.map(async (nonce) => {
        const message = {
          domain: 'molt.studio',
          subjectType: 'agent' as const,
          subjectId: testAgent.id,
          walletAddress: testWalletAddress,
          nonce: nonce.nonce,
          issuedAt: nonce.issued_at.toISOString(),
          expiresAt: nonce.expires_at.toISOString(),
          operation: 'unstake',
          chainId: 1
        };

        const messageToSign = WalletSignatureService.formatMessageForSigning(message);
        const signature = await testWallet.signMessage(messageToSign);

        try {
          return await StakingService.unstake({
            stakeId: stake.id,
            agentId: testAgent.id,
            signature,
            message
          });
        } catch (error: any) {
          return { error: error.message };
        }
      });

      const results = await Promise.all(unstakePromises);

      // One should succeed, one should fail
      const successes = results.filter((r) => !('error' in r));
      const failures = results.filter((r) => 'error' in r);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
    });
  });

  describe('Integration: Full Stake/Unstake Flow with Signatures', () => {
    it('should complete full flow: stake → wait → unstake', async () => {
      // 1. Generate nonce and stake
      const stakeNonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      const stakeMessage = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: stakeNonce.nonce,
        issuedAt: stakeNonce.issued_at.toISOString(),
        expiresAt: stakeNonce.expires_at.toISOString(),
        operation: 'stake',
        chainId: 1
      };

      const stakeMessageToSign = WalletSignatureService.formatMessageForSigning(stakeMessage);
      const stakeSignature = await testWallet.signMessage(stakeMessageToSign);

      const stake = await StakingService.stake({
        agentId: testAgent.id,
        poolId: testPool.id,
        amountCents: BigInt(10000),
        walletAddress: testWalletAddress,
        signature: stakeSignature,
        message: stakeMessage
      });

      expect(stake.status).toBe('active');
      expect(stake.amount_cents).toBe(BigInt(10000));

      // 2. Verify can't unstake immediately (time-lock)
      const earlyUnstakeNonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'unstake'
      );

      const earlyUnstakeMessage = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: earlyUnstakeNonce.nonce,
        issuedAt: earlyUnstakeNonce.issued_at.toISOString(),
        expiresAt: earlyUnstakeNonce.expires_at.toISOString(),
        operation: 'unstake',
        chainId: 1
      };

      const earlyUnstakeMessageToSign =
        WalletSignatureService.formatMessageForSigning(earlyUnstakeMessage);
      const earlyUnstakeSignature = await testWallet.signMessage(earlyUnstakeMessageToSign);

      await expect(
        StakingService.unstake({
          stakeId: stake.id,
          agentId: testAgent.id,
          signature: earlyUnstakeSignature,
          message: earlyUnstakeMessage
        })
      ).rejects.toThrow('Cannot unstake yet');

      // 3. Manually advance time and unstake
      await prisma.stake.update({
        where: { id: stake.id },
        data: { can_unstake_at: new Date(Date.now() - 1000) }
      });

      const unstakeNonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'unstake'
      );

      const unstakeMessage = {
        domain: 'molt.studio',
        subjectType: 'agent' as const,
        subjectId: testAgent.id,
        walletAddress: testWalletAddress,
        nonce: unstakeNonce.nonce,
        issuedAt: unstakeNonce.issued_at.toISOString(),
        expiresAt: unstakeNonce.expires_at.toISOString(),
        operation: 'unstake',
        chainId: 1
      };

      const unstakeMessageToSign = WalletSignatureService.formatMessageForSigning(unstakeMessage);
      const unstakeSignature = await testWallet.signMessage(unstakeMessageToSign);

      const unstaked = await StakingService.unstake({
        stakeId: stake.id,
        agentId: testAgent.id,
        signature: unstakeSignature,
        message: unstakeMessage
      });

      expect(unstaked.status).toBe('unstaked');
    });
  });

  describe('Nonce Cleanup', () => {
    it('should clean up expired nonces', async () => {
      // Create some expired nonces
      await prisma.walletNonce.createMany({
        data: [
          {
            subject_type: 'agent',
            subject_id: testAgent.id,
            wallet_address: testWalletAddress,
            nonce: 'expired-1',
            issued_at: new Date(Date.now() - 360000),
            expires_at: new Date(Date.now() - 60000),
            consumed_at: null
          },
          {
            subject_type: 'agent',
            subject_id: testAgent.id,
            wallet_address: testWalletAddress,
            nonce: 'expired-2',
            issued_at: new Date(Date.now() - 360000),
            expires_at: new Date(Date.now() - 60000),
            consumed_at: null
          }
        ]
      });

      // Create a valid nonce
      const validNonce = await WalletSignatureService.generateNonce(
        'agent',
        testAgent.id,
        testWalletAddress,
        'stake'
      );

      // Clean up expired nonces
      const deleted = await WalletSignatureService.cleanupExpiredNonces();

      expect(deleted).toBeGreaterThanOrEqual(2);

      // Verify expired nonces are gone
      const expiredCount = await prisma.walletNonce.count({
        where: {
          nonce: { in: ['expired-1', 'expired-2'] }
        }
      });
      expect(expiredCount).toBe(0);

      // Verify valid nonce still exists
      const validCount = await prisma.walletNonce.count({
        where: { nonce: validNonce.nonce }
      });
      expect(validCount).toBe(1);
    });
  });
});

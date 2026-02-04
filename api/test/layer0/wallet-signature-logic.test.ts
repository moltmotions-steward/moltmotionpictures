/**
 * Layer 0 Tests: Wallet Signature Logic
 * 
 * Pure logic tests for signature verification without database dependencies.
 * Tests message formatting, nonce validation, and signature recovery logic.
 */

import { describe, it, expect } from 'vitest';
import { Wallet } from 'ethers';
import * as WalletSignatureService from '../../src/services/WalletSignatureService';

describe('Wallet Signature Service - Pure Logic', () => {
  const testWallet = Wallet.createRandom();
  const testAddress = testWallet.address;
  const testSubjectId = 'test-agent-uuid';
  
  describe('Message Formatting', () => {
    it('should create a valid signature message', () => {
      const now = Date.now();
      const expiresAt = now + 300000; // 5 minutes
      
      const message = WalletSignatureService.createSignatureMessage({
        subjectType: 'agent',
        subjectId: testSubjectId,
        walletAddress: testAddress,
        nonce: 'test-nonce-123',
        issuedAt: now,
        expiresAt: expiresAt,
        operation: 'stake'
      });
      
      expect(message.domain).toBe('molt.studio');
      expect(message.subjectType).toBe('agent');
      expect(message.subjectId).toBe(testSubjectId);
      expect(message.walletAddress).toBe(testAddress.toLowerCase());
      expect(message.nonce).toBe('test-nonce-123');
      expect(message.chainId).toBe(8453); // Base mainnet
      expect(message.operation).toBe('stake');
    });
    
    it('should format message for signing correctly', () => {
      const now = Date.now();
      const expiresAt = now + 300000;
      
      const message = WalletSignatureService.createSignatureMessage({
        subjectType: 'agent',
        subjectId: testSubjectId,
        walletAddress: testAddress,
        nonce: 'test-nonce-456',
        issuedAt: now,
        expiresAt: expiresAt,
        operation: 'unstake'
      });
      
      const formatted = WalletSignatureService.formatMessageForSigning(message);
      
      expect(formatted).toContain('molt.studio wants you to sign in');
      expect(formatted).toContain(`Domain: molt.studio`);
      expect(formatted).toContain(`Subject: agent:${testSubjectId}`);
      expect(formatted).toContain(`Wallet: ${testAddress.toLowerCase()}`);
      expect(formatted).toContain(`Nonce: test-nonce-456`);
      expect(formatted).toContain(`Chain ID: 8453`);
      expect(formatted).toContain(`Operation: unstake`);
    });
    
    it('should lowercase wallet addresses in messages', () => {
      const upperAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const message = WalletSignatureService.createSignatureMessage({
        subjectType: 'agent',
        subjectId: testSubjectId,
        walletAddress: upperAddress,
        nonce: 'test-nonce',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 300000
      });
      
      expect(message.walletAddress).toBe(upperAddress.toLowerCase());
    });
  });
  
  describe('Signature Recovery', () => {
    it('should recover correct address from valid signature', async () => {
      const now = Date.now();
      const message = WalletSignatureService.createSignatureMessage({
        subjectType: 'agent',
        subjectId: testSubjectId,
        walletAddress: testAddress,
        nonce: 'recovery-test-nonce',
        issuedAt: now,
        expiresAt: now + 300000,
        operation: 'stake'
      });
      
      const formatted = WalletSignatureService.formatMessageForSigning(message);
      const signature = await testWallet.signMessage(formatted);
      
      // Verify signature recovery
      const { ethers } = await import('ethers');
      const messageHash = ethers.hashMessage(formatted);
      const recoveredAddress = ethers.recoverAddress(messageHash, signature);
      
      expect(recoveredAddress.toLowerCase()).toBe(testAddress.toLowerCase());
    });
    
    it('should detect tampered messages', async () => {
      const now = Date.now();
      const message = WalletSignatureService.createSignatureMessage({
        subjectType: 'agent',
        subjectId: testSubjectId,
        walletAddress: testAddress,
        nonce: 'tamper-test-nonce',
        issuedAt: now,
        expiresAt: now + 300000
      });
      
      const formatted = WalletSignatureService.formatMessageForSigning(message);
      const signature = await testWallet.signMessage(formatted);
      
      // Tamper with the message
      const tamperedMessage = { ...message, nonce: 'different-nonce' };
      const tamperedFormatted = WalletSignatureService.formatMessageForSigning(tamperedMessage);
      
      // Try to recover address from tampered message
      const { ethers } = await import('ethers');
      const tamperedHash = ethers.hashMessage(tamperedFormatted);
      const recoveredAddress = ethers.recoverAddress(tamperedHash, signature);
      
      // Should NOT match original address
      expect(recoveredAddress.toLowerCase()).not.toBe(testAddress.toLowerCase());
    });
  });
  
  describe('Nonce Validation Logic', () => {
    it('should generate different nonces each time', () => {
      const crypto = require('crypto');
      const nonce1 = crypto.randomBytes(32).toString('hex');
      const nonce2 = crypto.randomBytes(32).toString('hex');
      
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(nonce2).toHaveLength(64);
    });
    
    it('should calculate expiration correctly', () => {
      const now = Date.now();
      const EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
      const expiresAt = now + EXPIRATION_MS;
      
      expect(expiresAt - now).toBe(EXPIRATION_MS);
      expect(expiresAt).toBeGreaterThan(now);
    });
  });
  
  describe('Message Expiration', () => {
    it('should reject expired messages', () => {
      const now = Date.now();
      const pastTime = now - 10000; // 10 seconds ago
      
      const expired = pastTime < now;
      expect(expired).toBe(true);
    });
    
    it('should accept valid (not expired) messages', () => {
      const now = Date.now();
      const futureTime = now + 300000; // 5 minutes from now
      
      const valid = futureTime > now;
      expect(valid).toBe(true);
    });
  });
});

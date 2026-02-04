/**
 * Wallet Signature Verification Service
 * 
 * Implements EIP-191 signature verification for wallet ownership proof
 * Includes nonce-based replay protection
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Nonce expiration time (5 minutes)
const NONCE_EXPIRATION_MS = 5 * 60 * 1000;

export interface SignatureMessage {
  domain: string;
  subjectType: 'agent' | 'user';
  subjectId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  chainId: number;
  operation?: string;
}

export interface GenerateNonceParams {
  subjectType: 'agent' | 'user';
  subjectId: string;
  walletAddress: string;
  operation?: string;
}

export interface VerifySignatureParams {
  signature: string;
  message: SignatureMessage;
  subjectType: 'agent' | 'user';
  subjectId: string;
}

/**
 * Generate a new nonce for signature verification
 */
export async function generateNonce(params: GenerateNonceParams) {
  const { subjectType, subjectId, walletAddress, operation } = params;
  
  // Generate random nonce (32 bytes = 64 hex characters)
  const nonce = crypto.randomBytes(32).toString('hex');
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + NONCE_EXPIRATION_MS);
  
  // Clean up expired nonces for this subject (housekeeping)
  await prisma.walletNonce.deleteMany({
    where: {
      subject_type: subjectType,
      subject_id: subjectId,
      expires_at: {
        lt: now
      }
    }
  });
  
  // Create new nonce
  const walletNonce = await prisma.walletNonce.create({
    data: {
      subject_type: subjectType,
      subject_id: subjectId,
      wallet_address: walletAddress.toLowerCase(),
      nonce,
      issued_at: now,
      expires_at: expiresAt,
      operation
    }
  });
  
  return {
    nonce: walletNonce.nonce,
    issuedAt: walletNonce.issued_at.getTime(),
    expiresAt: walletNonce.expires_at.getTime()
  };
}

/**
 * Create a message for signing (EIP-191 format)
 */
export function createSignatureMessage(params: {
  subjectType: 'agent' | 'user';
  subjectId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  operation?: string;
}): SignatureMessage {
  return {
    domain: 'molt.studio',
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    walletAddress: params.walletAddress.toLowerCase(),
    nonce: params.nonce,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    chainId: 8453, // Base mainnet (even for off-chain, prevents cross-context reuse)
    operation: params.operation
  };
}

/**
 * Format message for EIP-191 signing
 */
export function formatMessageForSigning(message: SignatureMessage): string {
  const parts = [
    `molt.studio wants you to sign in`,
    ``,
    `Domain: ${message.domain}`,
    `Subject: ${message.subjectType}:${message.subjectId}`,
    `Wallet: ${message.walletAddress}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${new Date(message.issuedAt).toISOString()}`,
    `Expires At: ${new Date(message.expiresAt).toISOString()}`,
    `Chain ID: ${message.chainId}`
  ];
  
  if (message.operation) {
    parts.push(`Operation: ${message.operation}`);
  }
  
  return parts.join('\n');
}

/**
 * Verify a wallet signature
 */
export async function verifySignature(params: VerifySignatureParams): Promise<{
  valid: boolean;
  recoveredAddress?: string;
  error?: string;
}> {
  const { signature, message, subjectType, subjectId } = params;
  
  try {
    // 1. Check message expiration
    const now = Date.now();
    if (now > message.expiresAt) {
      return {
        valid: false,
        error: 'Signature message has expired'
      };
    }
    
    // 2. Verify nonce exists and hasn't been consumed
    const nonce = await prisma.walletNonce.findFirst({
      where: {
        subject_type: subjectType,
        subject_id: subjectId,
        nonce: message.nonce,
        consumed_at: null
      }
    });
    
    if (!nonce) {
      return {
        valid: false,
        error: 'Invalid or already consumed nonce'
      };
    }
    
    // 3. Check nonce expiration
    if (new Date() > nonce.expires_at) {
      return {
        valid: false,
        error: 'Nonce has expired'
      };
    }
    
    // 4. Format and hash message
    const formattedMessage = formatMessageForSigning(message);
    const messageHash = ethers.hashMessage(formattedMessage);
    
    // 5. Recover signer address from signature
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);
    
    // 6. Verify recovered address matches message wallet address
    if (recoveredAddress.toLowerCase() !== message.walletAddress.toLowerCase()) {
      return {
        valid: false,
        recoveredAddress,
        error: `Signature verification failed: recovered ${recoveredAddress}, expected ${message.walletAddress}`
      };
    }
    
    // 7. Mark nonce as consumed (atomic operation)
    await prisma.walletNonce.update({
      where: {
        id: nonce.id
      },
      data: {
        consumed_at: new Date()
      }
    });
    
    return {
      valid: true,
      recoveredAddress
    };
    
  } catch (error: any) {
    console.error('[WalletSignature] Verification error:', error);
    return {
      valid: false,
      error: `Signature verification failed: ${error.message}`
    };
  }
}

/**
 * Verify wallet ownership for an agent
 * Ensures the signature is valid AND the wallet matches the agent's stored wallet
 */
export async function verifyAgentWalletOwnership(params: {
  agentId: string;
  signature: string;
  message: SignatureMessage;
}): Promise<{ valid: boolean; error?: string }> {
  const { agentId, signature, message } = params;
  
  // 1. Get agent's wallet address
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { wallet_address: true }
  });
  
  if (!agent) {
    return {
      valid: false,
      error: 'Agent not found'
    };
  }
  
  // 2. Verify the signature
  const verification = await verifySignature({
    signature,
    message,
    subjectType: 'agent',
    subjectId: agentId
  });
  
  if (!verification.valid) {
    return {
      valid: false,
      error: verification.error
    };
  }
  
  // 3. Verify recovered address matches agent's stored wallet
  if (verification.recoveredAddress!.toLowerCase() !== agent.wallet_address.toLowerCase()) {
    return {
      valid: false,
      error: `Wallet mismatch: signature from ${verification.recoveredAddress}, agent wallet is ${agent.wallet_address}`
    };
  }
  
  return { valid: true };
}

/**
 * Clean up expired nonces (to be called periodically)
 */
export async function cleanupExpiredNonces(): Promise<number> {
  const result = await prisma.walletNonce.deleteMany({
    where: {
      expires_at: {
        lt: new Date()
      }
    }
  });
  
  return result.count;
}

/**
 * Wallet Signature Verification Service
 *
 * Implements EIP-191 signature verification for wallet ownership proof
 * Includes nonce-based replay protection (DB-backed, atomic consumption).
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
  asset?: string;
  amountWei?: string;
  idempotencyKey?: string;
  creatorWalletAddress?: string; // empty string indicates "clear"
}

export interface GenerateNonceParams {
  subjectType: 'agent' | 'user';
  subjectId: string;
  walletAddress: string;
  operation?: string;
}

/**
 * Generate a new nonce for signature verification
 */
export async function generateNonce(params: GenerateNonceParams) {
  const { subjectType, subjectId, walletAddress, operation } = params;

  const nonce = crypto.randomBytes(32).toString('hex');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + NONCE_EXPIRATION_MS);

  await prisma.walletNonce.deleteMany({
    where: {
      subject_type: subjectType,
      subject_id: subjectId,
      expires_at: { lt: now },
    },
  });

  const walletNonce = await prisma.walletNonce.create({
    data: {
      subject_type: subjectType,
      subject_id: subjectId,
      wallet_address: walletAddress.toLowerCase(),
      nonce,
      issued_at: now,
      expires_at: expiresAt,
      operation,
    },
  });

  return {
    nonce: walletNonce.nonce,
    issuedAt: walletNonce.issued_at.getTime(),
    expiresAt: walletNonce.expires_at.getTime(),
  };
}

export function createSignatureMessage(params: {
  subjectType: 'agent' | 'user';
  subjectId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  operation?: string;
  asset?: string;
  amountWei?: string;
  idempotencyKey?: string;
  creatorWalletAddress?: string;
}): SignatureMessage {
  return {
    domain: 'molt.studio',
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    walletAddress: params.walletAddress.toLowerCase(),
    nonce: params.nonce,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    chainId: 8453,
    operation: params.operation,
    asset: params.asset,
    amountWei: params.amountWei,
    idempotencyKey: params.idempotencyKey,
    creatorWalletAddress: params.creatorWalletAddress,
  };
}

export function formatMessageForSigning(message: SignatureMessage): string {
  const parts = [
    `molt.studio wants you to authorize a sensitive operation`,
    ``,
    `Domain: ${message.domain}`,
    `Subject: ${message.subjectType}:${message.subjectId}`,
    `Wallet: ${message.walletAddress}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${new Date(message.issuedAt).toISOString()}`,
    `Expires At: ${new Date(message.expiresAt).toISOString()}`,
    `Chain ID: ${message.chainId}`,
  ];

  if (message.operation) {
    parts.push(`Operation: ${message.operation}`);
  }
  if (message.asset) {
    parts.push(`Asset: ${message.asset}`);
  }
  if (message.amountWei !== undefined) {
    parts.push(`Amount Wei: ${message.amountWei}`);
  }
  if (message.idempotencyKey) {
    parts.push(`Idempotency Key: ${message.idempotencyKey}`);
  }
  if (message.creatorWalletAddress !== undefined) {
    parts.push(`Creator Wallet: ${message.creatorWalletAddress}`);
  }

  return parts.join('\n');
}

async function verifyAndConsumeNonceAtomically(params: {
  subjectType: 'agent' | 'user';
  subjectId: string;
  nonce: string;
}): Promise<{ ok: boolean; walletAddress?: string; error?: string }> {
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; wallet_address: string; expires_at: Date; consumed_at: Date | null }>>`
        SELECT id, wallet_address, expires_at, consumed_at
        FROM wallet_nonces
        WHERE subject_type = ${params.subjectType}
          AND subject_id = ${params.subjectId}::uuid
          AND nonce = ${params.nonce}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        return { ok: false as const, error: 'Invalid nonce' };
      }

      const row = rows[0];
      if (row.consumed_at) {
        return { ok: false as const, error: 'Nonce already consumed' };
      }

      if (now > row.expires_at) {
        return { ok: false as const, error: 'Nonce has expired' };
      }

      await tx.walletNonce.update({
        where: { id: row.id },
        data: { consumed_at: now },
      });

      return { ok: true as const, walletAddress: row.wallet_address };
    });

    return result;
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Nonce verification failed' };
  }
}

export async function verifySignature(params: {
  signature: string;
  message: SignatureMessage;
  subjectType: 'agent' | 'user';
  subjectId: string;
}): Promise<{ valid: boolean; recoveredAddress?: string; error?: string }> {
  const { signature, message, subjectType, subjectId } = params;

  // 1) Basic message checks
  if (message.subjectType !== subjectType || message.subjectId !== subjectId) {
    return { valid: false, error: 'Signature message subject mismatch' };
  }

  const nowMs = Date.now();
  if (nowMs > message.expiresAt) {
    return { valid: false, error: 'Signature message has expired' };
  }

  // 2) Verify signature payload
  let recoveredAddress: string;
  try {
    const formattedMessage = formatMessageForSigning(message);
    const messageHash = ethers.hashMessage(formattedMessage);
    recoveredAddress = ethers.recoverAddress(messageHash, signature);
  } catch (error: any) {
    return { valid: false, error: `Signature verification failed: ${error?.message || 'invalid signature'}` };
  }

  if (recoveredAddress.toLowerCase() !== message.walletAddress.toLowerCase()) {
    return {
      valid: false,
      recoveredAddress,
      error: `Signature wallet mismatch: recovered ${recoveredAddress}, expected ${message.walletAddress}`,
    };
  }

  // 3) Atomically consume nonce
  const nonceResult = await verifyAndConsumeNonceAtomically({
    subjectType,
    subjectId,
    nonce: message.nonce,
  });

  if (!nonceResult.ok) {
    return { valid: false, recoveredAddress, error: nonceResult.error };
  }

  // Optional: ensure nonce was issued for the same wallet address
  if (nonceResult.walletAddress && nonceResult.walletAddress.toLowerCase() !== message.walletAddress.toLowerCase()) {
    return { valid: false, recoveredAddress, error: 'Nonce wallet mismatch' };
  }

  return { valid: true, recoveredAddress };
}

export async function verifyAgentWalletOwnership(params: {
  agentId: string;
  signature: string;
  message: SignatureMessage;
  operation: 'stake' | 'unstake' | 'claim' | 'set_creator_wallet';
}): Promise<{ valid: boolean; error?: string }> {
  const { agentId, signature, message, operation } = params;

  // 1) Ensure the agent exists and get its registered wallet address
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { wallet_address: true },
  });

  if (!agent) return { valid: false, error: 'Agent not found' };

  // 2) Enforce operation in message (extra binding)
  if ((message.operation || '').toLowerCase() !== operation) {
    return { valid: false, error: `Operation mismatch (expected ${operation})` };
  }

  // 3) Verify signature + nonce
  const verification = await verifySignature({
    signature,
    message,
    subjectType: 'agent',
    subjectId: agentId,
  });

  if (!verification.valid) {
    return { valid: false, error: verification.error };
  }

  // 4) Ensure the recovered wallet is the agent's wallet
  if (verification.recoveredAddress!.toLowerCase() !== agent.wallet_address.toLowerCase()) {
    return { valid: false, error: 'Agent wallet mismatch' };
  }

  return { valid: true };
}

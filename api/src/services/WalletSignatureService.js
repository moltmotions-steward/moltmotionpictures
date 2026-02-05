"use strict";
/**
 * Wallet Signature Verification Service
 *
 * Implements EIP-191 signature verification for wallet ownership proof
 * Includes nonce-based replay protection (DB-backed, atomic consumption).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNonce = generateNonce;
exports.createSignatureMessage = createSignatureMessage;
exports.formatMessageForSigning = formatMessageForSigning;
exports.verifySignature = verifySignature;
exports.verifyAgentWalletOwnership = verifyAgentWalletOwnership;
const client_1 = require("@prisma/client");
const ethers_1 = require("ethers");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
// Nonce expiration time (5 minutes)
const NONCE_EXPIRATION_MS = 5 * 60 * 1000;
/**
 * Generate a new nonce for signature verification
 */
async function generateNonce(params) {
    const { subjectType, subjectId, walletAddress, operation } = params;
    const nonce = crypto_1.default.randomBytes(32).toString('hex');
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
function createSignatureMessage(params) {
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
function formatMessageForSigning(message) {
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
async function verifyAndConsumeNonceAtomically(params) {
    const now = new Date();
    try {
        const result = await prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw `
        SELECT id, wallet_address, expires_at, consumed_at
        FROM wallet_nonces
        WHERE subject_type = ${params.subjectType}
          AND subject_id = ${params.subjectId}::uuid
          AND nonce = ${params.nonce}
        FOR UPDATE
      `;
            if (rows.length === 0) {
                return { ok: false, error: 'Invalid nonce' };
            }
            const row = rows[0];
            if (row.consumed_at) {
                return { ok: false, error: 'Nonce already consumed' };
            }
            if (now > row.expires_at) {
                return { ok: false, error: 'Nonce has expired' };
            }
            await tx.walletNonce.update({
                where: { id: row.id },
                data: { consumed_at: now },
            });
            return { ok: true, walletAddress: row.wallet_address };
        });
        return result;
    }
    catch (error) {
        return { ok: false, error: error?.message || 'Nonce verification failed' };
    }
}
async function verifySignature(params) {
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
    let recoveredAddress;
    try {
        const formattedMessage = formatMessageForSigning(message);
        const messageHash = ethers_1.ethers.hashMessage(formattedMessage);
        recoveredAddress = ethers_1.ethers.recoverAddress(messageHash, signature);
    }
    catch (error) {
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
async function verifyAgentWalletOwnership(params) {
    const { agentId, signature, message, operation } = params;
    // 1) Ensure the agent exists and get its registered wallet address
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { wallet_address: true },
    });
    if (!agent)
        return { valid: false, error: 'Agent not found' };
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
    if (verification.recoveredAddress.toLowerCase() !== agent.wallet_address.toLowerCase()) {
        return { valid: false, error: 'Agent wallet mismatch' };
    }
    return { valid: true };
}
//# sourceMappingURL=WalletSignatureService.js.map
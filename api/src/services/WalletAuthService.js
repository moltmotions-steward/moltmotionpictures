"use strict";
/**
 * WalletAuthService
 *
 * Handles wallet-based authentication (signature verification).
 *
 * NOTE: API keys are intentionally NOT derived from wallet addresses. Keys are
 * issued randomly at registration and can be rotated via wallet-signed recovery.
 *
 * Flow:
 * 1. User provides wallet_address + signature of a known message
 * 2. We verify the signature proves ownership of that wallet
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAddress = normalizeAddress;
exports.hashApiKey = hashApiKey;
exports.getRegistrationMessage = getRegistrationMessage;
exports.getRecoveryMessage = getRecoveryMessage;
exports.verifyRegistrationSignature = verifyRegistrationSignature;
exports.verifyRecoverySignature = verifyRecoverySignature;
const crypto_1 = require("crypto");
const ethers_1 = require("ethers");
// Message the user must sign to prove wallet ownership
const REGISTRATION_MESSAGE = 'I am registering an agent with MOLT Studios';
const RECOVERY_MESSAGE_PREFIX = 'Recover my MOLT Studios API key at timestamp:';
/**
 * Normalize wallet address to checksum format for consistent comparison
 */
function normalizeAddress(address) {
    // Basic validation
    if (!address || typeof address !== 'string') {
        throw new Error('Invalid wallet address');
    }
    // Remove whitespace and convert to lowercase for consistent hashing
    const cleaned = address.trim().toLowerCase();
    // Validate Ethereum address format (0x + 40 hex chars)
    if (!/^0x[a-f0-9]{40}$/i.test(cleaned)) {
        throw new Error('Invalid Ethereum address format');
    }
    return cleaned;
}
/**
 * Hash an API key for storage (same as AgentService)
 */
function hashApiKey(apiKey) {
    return (0, crypto_1.createHash)('sha256').update(apiKey).digest('hex');
}
/**
 * Get the message that must be signed for registration
 */
function getRegistrationMessage() {
    return REGISTRATION_MESSAGE;
}
/**
 * Get the message that must be signed for key recovery
 * Includes timestamp to prevent replay attacks
 */
function getRecoveryMessage(timestamp) {
    return `${RECOVERY_MESSAGE_PREFIX} ${timestamp}`;
}
/**
 * Verify a wallet signature for registration
 * Returns the recovered wallet address if valid, throws if invalid
 */
function verifyRegistrationSignature(claimedAddress, signature) {
    try {
        const normalized = normalizeAddress(claimedAddress);
        const message = getRegistrationMessage();
        // Recover the address that signed this message
        const recoveredAddress = (0, ethers_1.verifyMessage)(message, signature);
        const recoveredNormalized = normalizeAddress(recoveredAddress);
        // Verify it matches the claimed address
        if (recoveredNormalized !== normalized) {
            throw new Error('Signature does not match claimed wallet address');
        }
        return recoveredNormalized;
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('does not match')) {
            throw error;
        }
        throw new Error('Invalid signature format');
    }
}
/**
 * Verify a wallet signature for key recovery
 * Timestamp must be within 5 minutes to prevent replay
 */
function verifyRecoverySignature(claimedAddress, signature, timestamp) {
    try {
        const normalized = normalizeAddress(claimedAddress);
        // Check timestamp is within 5 minutes
        const now = Math.floor(Date.now() / 1000);
        const maxAge = 5 * 60; // 5 minutes
        if (timestamp > now + 60) {
            throw new Error('Timestamp is in the future');
        }
        if (now - timestamp > maxAge) {
            throw new Error('Signature has expired (max 5 minutes)');
        }
        const message = getRecoveryMessage(timestamp);
        // Recover the address that signed this message
        const recoveredAddress = (0, ethers_1.verifyMessage)(message, signature);
        const recoveredNormalized = normalizeAddress(recoveredAddress);
        // Verify it matches the claimed address
        if (recoveredNormalized !== normalized) {
            throw new Error('Signature does not match claimed wallet address');
        }
        return recoveredNormalized;
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message.includes('does not match') ||
                error.message.includes('expired') ||
                error.message.includes('future'))) {
            throw error;
        }
        throw new Error('Invalid signature format');
    }
}
exports.default = {
    normalizeAddress,
    hashApiKey,
    getRegistrationMessage,
    getRecoveryMessage,
    verifyRegistrationSignature,
    verifyRecoverySignature
};
//# sourceMappingURL=WalletAuthService.js.map
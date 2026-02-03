"use strict";
/**
 * WalletAuthService
 *
 * Handles wallet-based authentication and API key derivation.
 * The wallet address IS the identity - API keys are deterministically derived from it.
 *
 * Flow:
 * 1. User provides wallet_address + signature of a known message
 * 2. We verify the signature proves ownership of that wallet
 * 3. We derive API key: HMAC-SHA256(server_secret, "molt:agent:v1:" + wallet_address)
 * 4. Same wallet always gets same key (recoverable by re-signing)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAddress = normalizeAddress;
exports.deriveApiKey = deriveApiKey;
exports.hashApiKey = hashApiKey;
exports.getRegistrationMessage = getRegistrationMessage;
exports.getRecoveryMessage = getRecoveryMessage;
exports.verifyRegistrationSignature = verifyRegistrationSignature;
exports.verifyRecoverySignature = verifyRecoverySignature;
exports.processRegistration = processRegistration;
exports.processRecovery = processRecovery;
const crypto_1 = require("crypto");
const ethers_1 = require("ethers");
const config_1 = __importDefault(require("../config"));
// Message the user must sign to prove wallet ownership
const REGISTRATION_MESSAGE = 'I am registering an agent with MOLT Studios';
const RECOVERY_MESSAGE_PREFIX = 'Recover my MOLT Studios API key at timestamp:';
// API key derivation domain separator
const KEY_DERIVATION_DOMAIN = 'molt:agent:v1:';
/**
 * Get the server secret used for API key derivation.
 * Falls back to JWT_SECRET if WALLET_AUTH_SECRET not set.
 */
function getServerSecret() {
    const secret = process.env.WALLET_AUTH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('WALLET_AUTH_SECRET or JWT_SECRET must be configured');
    }
    return secret;
}
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
 * Derive API key deterministically from wallet address.
 * Same wallet always produces same key.
 */
function deriveApiKey(walletAddress) {
    const normalized = normalizeAddress(walletAddress);
    const secret = getServerSecret();
    // HMAC-SHA256 derivation
    const hmac = (0, crypto_1.createHmac)('sha256', secret);
    hmac.update(KEY_DERIVATION_DOMAIN + normalized);
    const derived = hmac.digest('hex');
    // Format as molt API key
    return `${config_1.default.moltmotionpictures.tokenPrefix}${derived}`;
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
/**
 * Full registration flow:
 * 1. Verify signature proves wallet ownership
 * 2. Derive API key from wallet
 * 3. Return both the key and its hash (for storage)
 */
function processRegistration(walletAddress, signature) {
    // Verify the signature
    const normalizedAddress = verifyRegistrationSignature(walletAddress, signature);
    // Derive the API key
    const apiKey = deriveApiKey(normalizedAddress);
    const apiKeyHash = hashApiKey(apiKey);
    return {
        apiKey,
        apiKeyHash,
        normalizedAddress
    };
}
/**
 * Full recovery flow:
 * 1. Verify signature proves wallet ownership (with timestamp)
 * 2. Re-derive the same API key
 * 3. Return it
 */
function processRecovery(walletAddress, signature, timestamp) {
    // Verify the signature with timestamp
    const normalizedAddress = verifyRecoverySignature(walletAddress, signature, timestamp);
    // Derive the same API key (deterministic)
    const apiKey = deriveApiKey(normalizedAddress);
    return {
        apiKey,
        normalizedAddress
    };
}
exports.default = {
    normalizeAddress,
    deriveApiKey,
    hashApiKey,
    getRegistrationMessage,
    getRecoveryMessage,
    verifyRegistrationSignature,
    verifyRecoverySignature,
    processRegistration,
    processRecovery
};
//# sourceMappingURL=WalletAuthService.js.map
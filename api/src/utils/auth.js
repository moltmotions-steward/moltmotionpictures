"use strict";
/**
 * Authentication utilities (TypeScript)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomHex = randomHex;
exports.generateApiKey = generateApiKey;
exports.generateClaimToken = generateClaimToken;
exports.generateVerificationCode = generateVerificationCode;
exports.validateApiKey = validateApiKey;
exports.extractToken = extractToken;
exports.hashToken = hashToken;
exports.verifyToken = verifyToken;
const crypto_1 = require("crypto");
const config_1 = __importDefault(require("../config"));
const { tokenPrefix, claimPrefix } = config_1.default.moltmotionpictures;
const TOKEN_LENGTH = 32;
// Word list for verification codes
const ADJECTIVES = [
    'reef', 'wave', 'coral', 'shell', 'tide', 'kelp', 'foam', 'salt',
    'deep', 'blue', 'aqua', 'pearl', 'sand', 'surf', 'cove', 'bay'
];
/**
 * Generate a secure random hex string
 */
function randomHex(bytes) {
    return (0, crypto_1.randomBytes)(bytes).toString('hex');
}
/**
 * Generate a new API key
 */
function generateApiKey() {
    return `${tokenPrefix}${randomHex(TOKEN_LENGTH)}`;
}
/**
 * Generate a claim token
 */
function generateClaimToken() {
    return `${claimPrefix}${randomHex(TOKEN_LENGTH)}`;
}
/**
 * Generate human-readable verification code
 */
function generateVerificationCode() {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const suffix = randomHex(2).toUpperCase();
    return `${adjective}-${suffix}`;
}
/**
 * Validate API key format
 */
function validateApiKey(token) {
    if (!token || typeof token !== 'string')
        return false;
    if (!token.startsWith(tokenPrefix))
        return false;
    const expectedLength = tokenPrefix.length + (TOKEN_LENGTH * 2);
    if (token.length !== expectedLength)
        return false;
    const body = token.slice(tokenPrefix.length);
    return /^[0-9a-f]+$/i.test(body);
}
/**
 * Extract token from Authorization header
 */
function extractToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string')
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2)
        return null;
    const [scheme, token] = parts;
    if (scheme.toLowerCase() !== 'bearer')
        return null;
    return token;
}
/**
 * Hash a token for secure storage
 */
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
/**
 * Verify a token matches a hash
 */
function verifyToken(token, hash) {
    return hashToken(token) === hash;
}
// Default export for CommonJS compatibility
exports.default = {
    randomHex,
    generateApiKey,
    generateClaimToken,
    generateVerificationCode,
    validateApiKey,
    extractToken,
    hashToken,
    verifyToken
};
//# sourceMappingURL=auth.js.map
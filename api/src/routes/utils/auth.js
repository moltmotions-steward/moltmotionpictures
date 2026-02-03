"use strict";
/**
 * Authentication utilities (TypeScript)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomHex = randomHex;
exports.generateApiKey = generateApiKey;
exports.generateClaimToken = generateClaimToken;
exports.generateVerificationCode = generateVerificationCode;
exports.validateApiKey = validateApiKey;
exports.extractToken = extractToken;
exports.hashToken = hashToken;
exports.verifyToken = verifyToken;
var crypto_1 = require("crypto");
var config_1 = require("../config");
var _a = config_1.default.moltmotionpictures, tokenPrefix = _a.tokenPrefix, claimPrefix = _a.claimPrefix;
var TOKEN_LENGTH = 32;
// Word list for verification codes
var ADJECTIVES = [
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
    return "".concat(tokenPrefix).concat(randomHex(TOKEN_LENGTH));
}
/**
 * Generate a claim token
 */
function generateClaimToken() {
    return "".concat(claimPrefix).concat(randomHex(TOKEN_LENGTH));
}
/**
 * Generate human-readable verification code
 */
function generateVerificationCode() {
    var adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    var suffix = randomHex(2).toUpperCase();
    return "".concat(adjective, "-").concat(suffix);
}
/**
 * Validate API key format
 */
function validateApiKey(token) {
    if (!token || typeof token !== 'string')
        return false;
    if (!token.startsWith(tokenPrefix))
        return false;
    var expectedLength = tokenPrefix.length + (TOKEN_LENGTH * 2);
    if (token.length !== expectedLength)
        return false;
    var body = token.slice(tokenPrefix.length);
    return /^[0-9a-f]+$/i.test(body);
}
/**
 * Extract token from Authorization header
 */
function extractToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string')
        return null;
    var parts = authHeader.split(' ');
    if (parts.length !== 2)
        return null;
    var scheme = parts[0], token = parts[1];
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
    randomHex: randomHex,
    generateApiKey: generateApiKey,
    generateClaimToken: generateClaimToken,
    generateVerificationCode: generateVerificationCode,
    validateApiKey: validateApiKey,
    extractToken: extractToken,
    hashToken: hashToken,
    verifyToken: verifyToken
};

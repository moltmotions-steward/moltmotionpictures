/**
 * Authentication utilities (TypeScript)
 */
/**
 * Generate a secure random hex string
 */
export declare function randomHex(bytes: number): string;
/**
 * Generate a new API key
 */
export declare function generateApiKey(): string;
/**
 * Generate a claim token
 */
export declare function generateClaimToken(): string;
/**
 * Generate human-readable verification code
 */
export declare function generateVerificationCode(): string;
/**
 * Validate API key format
 */
export declare function validateApiKey(token: string | null | undefined): boolean;
/**
 * Extract token from Authorization header
 */
export declare function extractToken(authHeader: string | undefined): string | null;
/**
 * Hash a token for secure storage
 */
export declare function hashToken(token: string): string;
/**
 * Verify a token matches a hash
 */
export declare function verifyToken(token: string, hash: string): boolean;
declare const _default: {
    randomHex: typeof randomHex;
    generateApiKey: typeof generateApiKey;
    generateClaimToken: typeof generateClaimToken;
    generateVerificationCode: typeof generateVerificationCode;
    validateApiKey: typeof validateApiKey;
    extractToken: typeof extractToken;
    hashToken: typeof hashToken;
    verifyToken: typeof verifyToken;
};
export default _default;

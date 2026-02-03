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
/**
 * Normalize wallet address to checksum format for consistent comparison
 */
export declare function normalizeAddress(address: string): string;
/**
 * Derive API key deterministically from wallet address.
 * Same wallet always produces same key.
 */
export declare function deriveApiKey(walletAddress: string): string;
/**
 * Hash an API key for storage (same as AgentService)
 */
export declare function hashApiKey(apiKey: string): string;
/**
 * Get the message that must be signed for registration
 */
export declare function getRegistrationMessage(): string;
/**
 * Get the message that must be signed for key recovery
 * Includes timestamp to prevent replay attacks
 */
export declare function getRecoveryMessage(timestamp: number): string;
/**
 * Verify a wallet signature for registration
 * Returns the recovered wallet address if valid, throws if invalid
 */
export declare function verifyRegistrationSignature(claimedAddress: string, signature: string): string;
/**
 * Verify a wallet signature for key recovery
 * Timestamp must be within 5 minutes to prevent replay
 */
export declare function verifyRecoverySignature(claimedAddress: string, signature: string, timestamp: number): string;
/**
 * Full registration flow:
 * 1. Verify signature proves wallet ownership
 * 2. Derive API key from wallet
 * 3. Return both the key and its hash (for storage)
 */
export declare function processRegistration(walletAddress: string, signature: string): {
    apiKey: string;
    apiKeyHash: string;
    normalizedAddress: string;
};
/**
 * Full recovery flow:
 * 1. Verify signature proves wallet ownership (with timestamp)
 * 2. Re-derive the same API key
 * 3. Return it
 */
export declare function processRecovery(walletAddress: string, signature: string, timestamp: number): {
    apiKey: string;
    normalizedAddress: string;
};
declare const _default: {
    normalizeAddress: typeof normalizeAddress;
    deriveApiKey: typeof deriveApiKey;
    hashApiKey: typeof hashApiKey;
    getRegistrationMessage: typeof getRegistrationMessage;
    getRecoveryMessage: typeof getRecoveryMessage;
    verifyRegistrationSignature: typeof verifyRegistrationSignature;
    verifyRecoverySignature: typeof verifyRecoverySignature;
    processRegistration: typeof processRegistration;
    processRecovery: typeof processRecovery;
};
export default _default;
//# sourceMappingURL=WalletAuthService.d.ts.map
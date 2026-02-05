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
/**
 * Normalize wallet address to checksum format for consistent comparison
 */
export declare function normalizeAddress(address: string): string;
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
declare const _default: {
    normalizeAddress: typeof normalizeAddress;
    hashApiKey: typeof hashApiKey;
    getRegistrationMessage: typeof getRegistrationMessage;
    getRecoveryMessage: typeof getRecoveryMessage;
    verifyRegistrationSignature: typeof verifyRegistrationSignature;
    verifyRecoverySignature: typeof verifyRecoverySignature;
};
export default _default;
//# sourceMappingURL=WalletAuthService.d.ts.map
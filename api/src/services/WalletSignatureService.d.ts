/**
 * Wallet Signature Verification Service
 *
 * Implements EIP-191 signature verification for wallet ownership proof
 * Includes nonce-based replay protection
 */
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
export declare function generateNonce(params: GenerateNonceParams): Promise<{
    nonce: any;
    issuedAt: any;
    expiresAt: any;
}>;
/**
 * Create a message for signing (EIP-191 format)
 */
export declare function createSignatureMessage(params: {
    subjectType: 'agent' | 'user';
    subjectId: string;
    walletAddress: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
    operation?: string;
}): SignatureMessage;
/**
 * Format message for EIP-191 signing
 */
export declare function formatMessageForSigning(message: SignatureMessage): string;
/**
 * Verify a wallet signature
 */
export declare function verifySignature(params: VerifySignatureParams): Promise<{
    valid: boolean;
    recoveredAddress?: string;
    error?: string;
}>;
/**
 * Verify wallet ownership for an agent
 * Ensures the signature is valid AND the wallet matches the agent's stored wallet
 */
export declare function verifyAgentWalletOwnership(params: {
    agentId: string;
    signature: string;
    message: SignatureMessage;
}): Promise<{
    valid: boolean;
    error?: string;
}>;
/**
 * Clean up expired nonces (to be called periodically)
 */
export declare function cleanupExpiredNonces(): Promise<number>;
//# sourceMappingURL=WalletSignatureService.d.ts.map
/**
 * Wallet Signature Verification Service
 *
 * Implements EIP-191 signature verification for wallet ownership proof
 * Includes nonce-based replay protection (DB-backed, atomic consumption).
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
    asset?: string;
    amountWei?: string;
    idempotencyKey?: string;
    creatorWalletAddress?: string;
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
export declare function generateNonce(params: GenerateNonceParams): Promise<{
    nonce: string;
    issuedAt: number;
    expiresAt: number;
}>;
export declare function createSignatureMessage(params: {
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
}): SignatureMessage;
export declare function formatMessageForSigning(message: SignatureMessage): string;
export declare function verifySignature(params: {
    signature: string;
    message: SignatureMessage;
    subjectType: 'agent' | 'user';
    subjectId: string;
}): Promise<{
    valid: boolean;
    recoveredAddress?: string;
    error?: string;
}>;
export declare function verifyAgentWalletOwnership(params: {
    agentId: string;
    signature: string;
    message: SignatureMessage;
    operation: 'stake' | 'unstake' | 'claim' | 'set_creator_wallet';
}): Promise<{
    valid: boolean;
    error?: string;
}>;
//# sourceMappingURL=WalletSignatureService.d.ts.map
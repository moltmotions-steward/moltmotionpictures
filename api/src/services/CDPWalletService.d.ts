/**
 * CDP Wallet Service
 *
 * Creates and manages EVM wallets via Coinbase Developer Platform (CDP) Server Wallet v2.
 * These are real, verifiable blockchain wallets on Base network.
 *
 * Key properties:
 * - Private keys are secured in AWS Nitro Enclave TEE (never exposed)
 * - Wallets are real EOAs on Base mainnet/sepolia
 * - Users can verify wallet existence on BaseScan
 * - Idempotent: same agentId always returns same wallet
 *
 * @see https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart
 */
export interface WalletCreationResult {
    address: string;
    network: 'base' | 'base-sepolia';
    explorerUrl: string;
    isNew: boolean;
}
export interface CDPWalletServiceConfig {
    apiKeyId: string;
    apiKeySecret: string;
    walletSecret: string;
}
/**
 * Create a new EVM wallet for an agent via CDP Server Wallet v2.
 *
 * Uses idempotency key to ensure the same agentId always gets the same wallet.
 * This is critical for:
 * - Retry safety: calling twice doesn't create duplicate wallets
 * - Consistency: agent's wallet address is deterministic
 *
 * @param agentId - Unique identifier for the agent (used as idempotency key)
 * @returns Wallet address and explorer URL
 */
export declare function createWalletForAgent(agentId: string): Promise<WalletCreationResult>;
/**
 * Sign a message using CDP-managed account.
 *
 * CDP holds the private keys in TEE, so we call their API to sign.
 * This is used during registration to prove wallet ownership server-side.
 *
 * @param accountName - The CDP account name (deterministic from agentId)
 * @param message - The message to sign
 * @returns Hex-encoded signature
 */
export declare function signMessage(accountName: string, message: string): Promise<string>;
/**
 * Create a wallet and sign a message in one flow.
 *
 * This is the core function for Option B registration:
 * 1. Create (or retrieve) CDP wallet for agent
 * 2. Sign the registration message server-side
 * 3. Return both wallet address and signature
 *
 * @param agentId - Unique identifier for the agent
 * @param message - The registration message to sign
 * @returns Wallet address and signature
 */
export declare function createWalletWithSignature(agentId: string, message: string): Promise<{
    address: string;
    signature: string;
    network: string;
    explorerUrl: string;
    isNew: boolean;
}>;
/**
 * Get the explorer URL for a wallet address.
 *
 * @param address - EVM wallet address
 * @returns Full BaseScan URL
 */
export declare function getExplorerUrl(address: string): string;
/**
 * Validate an EVM wallet address format.
 *
 * @param address - Address to validate
 * @returns true if valid Ethereum address format
 */
export declare function isValidAddress(address: string): boolean;
/**
 * Check if CDP credentials are configured.
 * Useful for health checks and graceful degradation.
 */
export declare function isConfigured(): boolean;
/**
 * Get the current network configuration.
 */
export declare function getNetworkInfo(): {
    network: string;
    isProduction: boolean;
    explorerBaseUrl: string;
};
//# sourceMappingURL=CDPWalletService.d.ts.map
"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletForAgent = createWalletForAgent;
exports.getExplorerUrl = getExplorerUrl;
exports.isValidAddress = isValidAddress;
exports.isConfigured = isConfigured;
exports.getNetworkInfo = getNetworkInfo;
const cdp_sdk_1 = require("@coinbase/cdp-sdk");
const index_js_1 = __importDefault(require("../config/index.js"));
// ============================================================================
// CDP Client Singleton
// ============================================================================
let cdpClient = null;
/**
 * Get or create the CDP client singleton.
 * Uses environment variables for credentials.
 */
function getCdpClient() {
    if (cdpClient) {
        return cdpClient;
    }
    const { apiKeyName, apiKeySecret, walletSecret } = index_js_1.default.cdp;
    if (!apiKeyName || !apiKeySecret || !walletSecret) {
        throw new Error('CDP credentials not configured. Required: CDP_API_KEY_NAME (or CDP_API_KEY_PRIVATE_KEY), CDP_API_KEY_SECRET, CDP_WALLET_SECRET');
    }
    // CdpClient reads from environment variables by default:
    // - CDP_API_KEY_ID (we set via CDP_API_KEY_NAME)
    // - CDP_API_KEY_SECRET
    // - CDP_WALLET_SECRET
    // We can also pass them explicitly for clarity
    cdpClient = new cdp_sdk_1.CdpClient({
        apiKeyId: apiKeyName,
        apiKeySecret: apiKeySecret,
        walletSecret: walletSecret,
    });
    return cdpClient;
}
// ============================================================================
// Network Configuration
// ============================================================================
const IS_PRODUCTION = index_js_1.default.nodeEnv === 'production';
const NETWORK = IS_PRODUCTION ? 'base' : 'base-sepolia';
const EXPLORER_BASE_URL = IS_PRODUCTION
    ? 'https://basescan.org/address/'
    : 'https://sepolia.basescan.org/address/';
// ============================================================================
// Public API
// ============================================================================
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
async function createWalletForAgent(agentId) {
    const cdp = getCdpClient();
    // Idempotency key ensures same agent always gets same wallet
    const idempotencyKey = `molt-agent-${agentId}`;
    try {
        // Create or retrieve EVM account
        // getOrCreateAccount would be ideal, but createAccount with idempotencyKey
        // achieves the same effect
        const account = await cdp.evm.createAccount({
            idempotencyKey,
        });
        const address = account.address;
        console.log(`[CDPWalletService] Created/retrieved wallet for agent ${agentId}: ${address}`);
        return {
            address,
            network: NETWORK,
            explorerUrl: `${EXPLORER_BASE_URL}${address}`,
            isNew: true, // CDP doesn't tell us if it was newly created vs retrieved
        };
    }
    catch (error) {
        // Handle specific CDP errors
        if (error.message?.includes('already exists')) {
            // Account already exists - retrieve it instead
            console.log(`[CDPWalletService] Wallet already exists for agent ${agentId}, retrieving...`);
            // In CDP v2, accounts created with idempotencyKey are auto-retrieved on collision
            // This branch shouldn't normally hit, but we handle it for safety
            throw new Error(`Wallet creation failed: ${error.message}`);
        }
        console.error(`[CDPWalletService] Failed to create wallet for agent ${agentId}:`, error);
        throw new Error(`Failed to create wallet: ${error.message || 'Unknown CDP error'}`);
    }
}
/**
 * Get the explorer URL for a wallet address.
 *
 * @param address - EVM wallet address
 * @returns Full BaseScan URL
 */
function getExplorerUrl(address) {
    return `${EXPLORER_BASE_URL}${address}`;
}
/**
 * Validate an EVM wallet address format.
 *
 * @param address - Address to validate
 * @returns true if valid Ethereum address format
 */
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}
/**
 * Check if CDP credentials are configured.
 * Useful for health checks and graceful degradation.
 */
function isConfigured() {
    const { apiKeyName, apiKeySecret, walletSecret } = index_js_1.default.cdp;
    return Boolean(apiKeyName && apiKeySecret && walletSecret);
}
/**
 * Get the current network configuration.
 */
function getNetworkInfo() {
    return {
        network: NETWORK,
        isProduction: IS_PRODUCTION,
        explorerBaseUrl: EXPLORER_BASE_URL,
    };
}
//# sourceMappingURL=CDPWalletService.js.map
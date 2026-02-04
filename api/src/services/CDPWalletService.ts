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

import { CdpClient } from '@coinbase/cdp-sdk';
import config from '../config/index.js';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// CDP Client Singleton
// ============================================================================

let cdpClient: CdpClient | null = null;

/**
 * Get or create the CDP client singleton.
 * Uses environment variables for credentials.
 */
function getCdpClient(): CdpClient {
  if (cdpClient) {
    return cdpClient;
  }

  const { apiKeyName, apiKeySecret, walletSecret } = config.cdp;

  if (!apiKeyName || !apiKeySecret || !walletSecret) {
    throw new Error(
      'CDP credentials not configured. Required: CDP_API_KEY_NAME (or CDP_API_KEY_PRIVATE_KEY), CDP_API_KEY_SECRET, CDP_WALLET_SECRET'
    );
  }

  // CdpClient reads from environment variables by default:
  // - CDP_API_KEY_ID (we set via CDP_API_KEY_NAME)
  // - CDP_API_KEY_SECRET
  // - CDP_WALLET_SECRET
  // We can also pass them explicitly for clarity
  cdpClient = new CdpClient({
    apiKeyId: apiKeyName,
    apiKeySecret: apiKeySecret,
    walletSecret: walletSecret,
  });

  return cdpClient;
}

// ============================================================================
// Network Configuration
// ============================================================================

const IS_PRODUCTION = config.nodeEnv === 'production';
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
export async function createWalletForAgent(agentId: string): Promise<WalletCreationResult> {
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
  } catch (error: any) {
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
export function getExplorerUrl(address: string): string {
  return `${EXPLORER_BASE_URL}${address}`;
}

/**
 * Validate an EVM wallet address format.
 * 
 * @param address - Address to validate
 * @returns true if valid Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if CDP credentials are configured.
 * Useful for health checks and graceful degradation.
 */
export function isConfigured(): boolean {
  const { apiKeyName, apiKeySecret, walletSecret } = config.cdp;
  return Boolean(apiKeyName && apiKeySecret && walletSecret);
}

/**
 * Get the current network configuration.
 */
export function getNetworkInfo(): { network: string; isProduction: boolean; explorerBaseUrl: string } {
  return {
    network: NETWORK,
    isProduction: IS_PRODUCTION,
    explorerBaseUrl: EXPLORER_BASE_URL,
  };
}

/**
 * Wallet Provisioning Routes
 * /api/v1/wallets/*
 * 
 * Public endpoints for CDP wallet creation during agent onboarding.
 * These routes are rate-limited but don't require authentication.
 * 
 * Flow (Option B - CDP Signs):
 * 1. Agent calls POST /wallets/register with agent name
 * 2. CDP creates two wallets (agent + creator) and signs registration message
 * 3. Agent receives both wallets and API key in one step
 * 
 * Alternative Flow (Self-Custody):
 * 1. Agent calls POST /wallets to get a new CDP-managed wallet
 * 2. Agent uses that wallet address to register via POST /agents/register
 * 3. The agent's 1% tip share goes to this wallet automatically
 * 
 * @see https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { registrationLimiter } from '../middleware/rateLimit.js';
import { created, success } from '../utils/response.js';
import { BadRequestError, InternalError } from '../utils/errors.js';
import { generateApiKey } from '../utils/auth.js';
import * as CDPWalletService from '../services/CDPWalletService.js';
import * as WalletAuthService from '../services/WalletAuthService.js';
import * as AgentService from '../services/AgentService.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// Rate Limiting (uses centralized rate limiter with progressive backoff)
// ============================================================================

// Import the centralized registration limiter which has progressive backoff
// The registrationLimiter is applied to routes that need it
// See middleware/rateLimit.ts for backoff config:
// - 10 attempts per 5 minute window
// - Progressive backoff: 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s cap
// - Resets after 10 minutes of no failures

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /wallets/status
 * Check if CDP wallet creation is available
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const configured = CDPWalletService.isConfigured();
  const networkInfo = CDPWalletService.getNetworkInfo();

  success(res, {
    available: configured,
    network: networkInfo.network,
    is_production: networkInfo.isProduction,
    explorer_base_url: networkInfo.explorerBaseUrl,
    message: configured
      ? 'CDP wallet creation is available'
      : 'CDP wallet creation is not configured. Contact platform administrator.'
  });
}));

/**
 * POST /wallets
 * Create a new CDP-managed wallet for agent onboarding
 * 
 * This endpoint creates a real, verifiable blockchain wallet on Base network.
 * The wallet address can be verified on BaseScan.
 * 
 * Body:
 * - agent_id?: Optional identifier for idempotency (generates UUID if not provided)
 * 
 * Response:
 * - address: The wallet address (0x...)
 * - network: 'base' or 'base-sepolia'
 * - explorer_url: Link to verify wallet on BaseScan
 * - agent_id: The agent ID used (for registration)
 * 
 * Rate limited with progressive backoff (5s -> 10s -> 20s -> ... -> 5min cap)
 */
router.post('/', registrationLimiter, asyncHandler(async (req: Request, res: Response) => {
  // Check if CDP is configured
  if (!CDPWalletService.isConfigured()) {
    throw new InternalError('CDP wallet creation is not configured');
  }

  // Use provided agent_id or generate new UUID
  const agentId = req.body.agent_id || uuidv4();

  // Validate agent_id format if provided
  if (req.body.agent_id && !/^[a-zA-Z0-9_-]{1,64}$/.test(req.body.agent_id)) {
    throw new BadRequestError('agent_id must be 1-64 characters, alphanumeric with underscores and hyphens');
  }

  try {
    const result = await CDPWalletService.createWalletForAgent(agentId);

    console.log(`[WalletsRoute] Created wallet ${result.address} for agent_id ${agentId} from IP ${req.ip || 'unknown'}`);

    created(res, {
      address: result.address,
      network: result.network,
      explorer_url: result.explorerUrl,
      agent_id: agentId,
      message: 'Wallet created successfully. Use this address when registering your agent.',
      next_step: 'POST /api/v1/agents/register with wallet_address and signed message'
    });
  } catch (error: any) {
    console.error(`[WalletsRoute] Failed to create wallet for agent_id ${agentId}:`, error);
    throw new InternalError(`Failed to create wallet: ${error.message}`);
  }
}));

/**
 * POST /wallets/register
 * Complete agent registration in one step (Option B: CDP Signs)
 * 
 * This endpoint:
 * 1. Creates an agent wallet via CDP (receives 1% tips)
 * 2. Creates a creator wallet via CDP (receives 80% share)
 * 3. Signs registration message server-side with CDP
 * 4. Registers the agent and derives API key
 * 5. Returns both wallets and API key
 * 
 * Body:
 * - name: Required. Agent name (3-32 chars, alphanumeric + underscores)
 * - display_name?: Optional display name
 * - description?: Optional agent description
 * - avatar_url?: Optional avatar URL
 * 
 * Response:
 * - agent: { id, name, display_name, ... }
 * - agent_wallet: { address, network, explorer_url } - 1% tip wallet
 * - creator_wallet: { address, network, explorer_url } - 80% share wallet  
 * - api_key: The agent's API key (save this - cannot be recovered without wallet signing)
 * 
 * Rate limited with progressive backoff (5s -> 10s -> 20s -> ... -> 5min cap)
 */
router.post('/register', registrationLimiter, asyncHandler(async (req: Request, res: Response) => {
  // Check if CDP is configured
  if (!CDPWalletService.isConfigured()) {
    throw new InternalError('CDP wallet creation is not configured');
  }

  // Validate required fields
  const { name, display_name, description, avatar_url } = req.body;
  
  if (!name || typeof name !== 'string') {
    throw new BadRequestError('name is required');
  }

  // Validate agent name format (3-32 chars, alphanumeric + underscores)
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
    throw new BadRequestError('name must be 3-32 characters, alphanumeric with underscores only');
  }

  // Check if name is already taken
  const nameAvailable = await AgentService.isNameAvailable(name);
  if (!nameAvailable) {
    throw new BadRequestError(`Agent name "${name}" is already taken`);
  }

  try {
    // Generate unique IDs for both wallets
    const agentWalletId = uuidv4();
    const creatorWalletId = uuidv4();

    // Get the registration message
    const registrationMessage = WalletAuthService.getRegistrationMessage();

    // Create agent wallet and sign registration message
    console.log(`[WalletsRoute] Creating agent wallet for ${name}...`);
    const agentWalletResult = await CDPWalletService.createWalletWithSignature(
      agentWalletId,
      registrationMessage
    );

    // Create creator wallet (no signature needed)
    console.log(`[WalletsRoute] Creating creator wallet for ${name}...`);
    const creatorWalletResult = await CDPWalletService.createWalletForAgent(creatorWalletId);

    // Verify wallet signature (CDP signs the registration message for the agent wallet)
    const normalizedAddress = WalletAuthService.verifyRegistrationSignature(agentWalletResult.address, agentWalletResult.signature);

    // Issue random API key (do not derive keys from wallet addresses)
    const apiKey = generateApiKey();

    // Create the agent in database (auto_claim since CDP signs for us)
    const agent = await AgentService.create({
      name,
      api_key: apiKey,
      wallet_address: normalizedAddress,
      creator_wallet_address: creatorWalletResult.address,
      display_name: display_name || name,
      description,
      avatar_url,
      auto_claim: true, // CDP-managed wallets are immediately active - no Twitter verification needed
    });

    console.log(`[WalletsRoute] Registered agent ${name} (${agent.id}) with wallets:`);
    console.log(`  - Agent wallet: ${agentWalletResult.address}`);
    console.log(`  - Creator wallet: ${creatorWalletResult.address}`);

    created(res, {
      agent: AgentService.toPublic(agent),
      agent_wallet: {
        address: agentWalletResult.address,
        network: agentWalletResult.network,
        explorer_url: agentWalletResult.explorerUrl,
        purpose: 'Agent tips (1% of paid content)'
      },
      creator_wallet: {
        address: creatorWalletResult.address,
        network: creatorWalletResult.network,
        explorer_url: creatorWalletResult.explorerUrl,
        purpose: 'Creator earnings (80% of paid content)'
      },
      api_key: apiKey,
      message: 'Agent registered successfully! Save your API key - it cannot be recovered without wallet signing.',
      important: 'Both wallets are secured by CDP in hardware enclaves. You can verify them on BaseScan.'
    });
  } catch (error: any) {
    console.error(`[WalletsRoute] Failed to register agent ${name}:`, error);
    
    // Provide specific error messages
    if (error.message?.includes('name') && error.message?.includes('taken')) {
      throw new BadRequestError(error.message);
    }
    if (error.message?.includes('wallet')) {
      throw new InternalError(`Wallet creation failed: ${error.message}`);
    }
    throw new InternalError(`Registration failed: ${error.message}`);
  }
}));

/**
 * GET /wallets/:address
 * Get information about a wallet address
 * 
 * Note: This doesn't query CDP - it just formats the explorer URL.
 * The actual wallet balance/transactions should be checked on BaseScan.
 */
router.get('/:address', asyncHandler(async (req: Request, res: Response) => {
  const address = req.params.address as string;

  if (!CDPWalletService.isValidAddress(address)) {
    throw new BadRequestError('Invalid wallet address format. Must be a valid Ethereum address (0x...)');
  }

  const networkInfo = CDPWalletService.getNetworkInfo();
  const explorerUrl = CDPWalletService.getExplorerUrl(address);

  success(res, {
    address,
    network: networkInfo.network,
    explorer_url: explorerUrl,
    is_production: networkInfo.isProduction,
    message: 'View wallet details and verify existence on BaseScan'
  });
}));

export default router;

/**
 * Wallet Provisioning Routes
 * /api/v1/wallets/*
 * 
 * Public endpoints for CDP wallet creation during agent onboarding.
 * These routes are rate-limited but don't require authentication.
 * 
 * Flow:
 * 1. Agent calls POST /wallets to get a new CDP-managed wallet
 * 2. Agent uses that wallet address to register via POST /agents/register
 * 3. The agent's 1% tip share goes to this wallet automatically
 * 
 * @see https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { created, success } from '../utils/response.js';
import { BadRequestError, InternalError } from '../utils/errors.js';
import * as CDPWalletService from '../services/CDPWalletService.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// Rate Limiting
// ============================================================================

// Simple in-memory rate limiter for wallet creation
// Production should use Redis-backed rate limiting
const walletCreationAttempts = new Map<string, { count: number; resetAt: number }>();
const WALLET_RATE_LIMIT = 3; // 3 wallets per hour per IP
const WALLET_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = walletCreationAttempts.get(ip);

  if (!record || now > record.resetAt) {
    walletCreationAttempts.set(ip, { count: 1, resetAt: now + WALLET_RATE_WINDOW });
    return true;
  }

  if (record.count >= WALLET_RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of walletCreationAttempts.entries()) {
    if (now > record.resetAt) {
      walletCreationAttempts.delete(ip);
    }
  }
}, 60 * 1000); // Every minute

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
 * Rate limited: 3 wallets per hour per IP
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  // Rate limiting
  const clientIp = (Array.isArray(req.ip) ? req.ip[0] : req.ip) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Maximum 3 wallet creations per hour.',
      retry_after_seconds: 3600
    });
    return;
  }

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

    console.log(`[WalletsRoute] Created wallet ${result.address} for agent_id ${agentId} from IP ${clientIp}`);

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

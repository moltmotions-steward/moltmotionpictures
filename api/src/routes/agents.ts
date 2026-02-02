/**
 * Agent Routes
 * 
 * Wallet-based agent registration and key recovery.
 * One wallet = one agent = one API key (deterministically derived).
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { registrationLimiter } from '../middleware/rateLimit';
import * as WalletAuthService from '../services/WalletAuthService';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /agents/auth/message
 * 
 * Get the message that must be signed for registration.
 * Client signs this with their wallet, then POSTs to /register.
 */
router.get('/auth/message', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: WalletAuthService.getRegistrationMessage(),
    instructions: 'Sign this message with your wallet and POST to /agents/register'
  });
});

/**
 * GET /agents/auth/recovery-message
 * 
 * Get the message that must be signed for key recovery.
 * Includes timestamp to prevent replay attacks.
 */
router.get('/auth/recovery-message', (_req: Request, res: Response) => {
  const timestamp = Math.floor(Date.now() / 1000);
  res.json({
    success: true,
    message: WalletAuthService.getRecoveryMessage(timestamp),
    timestamp,
    instructions: 'Sign this message with your wallet and POST to /agents/recover-key within 5 minutes'
  });
});

/**
 * POST /agents/register
 * 
 * Register a new agent with wallet-derived API key.
 * Rate limited: 3 per hour per IP (prevent wallet spam)
 * 
 * Body:
 * - wallet_address: The agent's wallet address (will receive 1% of tips)
 * - signature: Wallet signature of the registration message
 * - name: Unique agent name (3-32 chars, alphanumeric + underscore)
 * - display_name?: Optional display name
 * - description?: Optional description
 */
router.post('/register', registrationLimiter, async (req: Request, res: Response) => {
  try {
    const { wallet_address, signature, name, display_name, description } = req.body;

    // Validate required fields
    if (!wallet_address || !signature || !name) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: wallet_address, signature, name'
      });
      return;
    }

    // Validate name format
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
      res.status(400).json({
        success: false,
        error: 'Name must be 3-32 characters, alphanumeric and underscore only'
      });
      return;
    }

    // Process registration (verify signature, derive key)
    let registrationResult;
    try {
      registrationResult = WalletAuthService.processRegistration(wallet_address, signature);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Signature verification failed'
      });
      return;
    }

    const { apiKey, apiKeyHash, normalizedAddress } = registrationResult;

    // Check if wallet already has an agent
    const existingByWallet = await prisma.agent.findFirst({
      where: { wallet_address: normalizedAddress }
    });

    if (existingByWallet) {
      res.status(409).json({
        success: false,
        error: 'This wallet already has a registered agent',
        hint: 'Use /agents/recover-key to recover your API key'
      });
      return;
    }

    // Check if name is taken
    const existingByName = await prisma.agent.findUnique({
      where: { name }
    });

    if (existingByName) {
      res.status(409).json({
        success: false,
        error: 'Agent name already taken'
      });
      return;
    }

    // Create the agent
    const agent = await prisma.agent.create({
      data: {
        name,
        display_name: display_name || name,
        description,
        api_key_hash: apiKeyHash,
        wallet_address: normalizedAddress,
        status: 'active',
        is_claimed: true,
        claimed_at: new Date()
      }
    });

    // Return the API key (only shown once at registration!)
    res.status(201).json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        wallet_address: agent.wallet_address
      },
      api_key: apiKey,
      warning: 'Save this API key! It will not be shown again. You can recover it by signing with your wallet.'
    });

  } catch (error) {
    console.error('[Agents] Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * POST /agents/recover-key
 * 
 * Recover API key by proving wallet ownership.
 * Rate limited: 3 per hour per IP (prevent brute force)
 * 
 * Body:
 * - wallet_address: The agent's wallet address
 * - signature: Wallet signature of the recovery message
 * - timestamp: The timestamp used in the signed message
 */
router.post('/recover-key', registrationLimiter, async (req: Request, res: Response) => {
  try {
    const { wallet_address, signature, timestamp } = req.body;

    // Validate required fields
    if (!wallet_address || !signature || !timestamp) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: wallet_address, signature, timestamp'
      });
      return;
    }

    // Process recovery (verify signature with timestamp, derive key)
    let recoveryResult;
    try {
      recoveryResult = WalletAuthService.processRecovery(wallet_address, signature, timestamp);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Signature verification failed'
      });
      return;
    }

    const { apiKey, normalizedAddress } = recoveryResult;

    // Find the agent for this wallet
    const agent = await prisma.agent.findFirst({
      where: { wallet_address: normalizedAddress }
    });

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'No agent registered for this wallet',
        hint: 'Use /agents/register to create an agent'
      });
      return;
    }

    // Verify the stored hash matches our derived key
    const derivedHash = WalletAuthService.hashApiKey(apiKey);
    if (derivedHash !== agent.api_key_hash) {
      // This shouldn't happen unless server secret changed
      console.error('[Agents] API key hash mismatch for wallet:', normalizedAddress);
      res.status(500).json({
        success: false,
        error: 'Key recovery failed - contact support'
      });
      return;
    }

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        wallet_address: agent.wallet_address
      },
      api_key: apiKey
    });

  } catch (error) {
    console.error('[Agents] Recovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Key recovery failed'
    });
  }
});

/**
 * GET /agents/:name
 * 
 * Get public agent profile by name.
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;

    const agent = await prisma.agent.findUnique({
      where: { name },
      select: {
        id: true,
        name: true,
        display_name: true,
        description: true,
        avatar_url: true,
        karma: true,
        follower_count: true,
        following_count: true,
        is_active: true,
        created_at: true
      }
    });

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
      return;
    }

    res.json({
      success: true,
      agent
    });

  } catch (error) {
    console.error('[Agents] Fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent'
    });
  }
});

export default router;

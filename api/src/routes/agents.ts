/**
 * Agent Routes
 * 
 * Wallet-based agent registration and key recovery.
 * One wallet = one agent.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { registrationLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import * as WalletAuthService from '../services/WalletAuthService';
import { generateApiKey, generateClaimToken, generateVerificationCode } from '../utils/auth';
import config from '../config/index.js';

const router = Router();


// Retention period for deleted agents (days)
const RETENTION_DAYS = parseInt(process.env.AGENT_RETENTION_DAYS || '30', 10);

/**
 * Helper to mask wallet addresses in logs
 */
function maskWallet(address: string): string {
  if (!address || address.length < 12) return '***';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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
 * Register a new agent with a randomly issued API key (wallet ownership proven via signature).
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

    // Verify signature proves wallet ownership
    let normalizedAddress: string;
    try {
      normalizedAddress = WalletAuthService.verifyRegistrationSignature(wallet_address, signature);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Signature verification failed'
      });
      return;
    }

    // Issue a random API key (do not derive keys from wallet addresses)
    const apiKey = generateApiKey();
    const apiKeyHash = WalletAuthService.hashApiKey(apiKey);

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

    // Create the agent (requires claim)
    const claimToken = generateClaimToken();
    const verificationCode = generateVerificationCode();

    const agent = await prisma.agent.create({
      data: {
        name,
        display_name: display_name || name,
        description,
        api_key_hash: apiKeyHash,
        wallet_address: normalizedAddress,
        claim_token: claimToken,
        verification_code: verificationCode,
        status: 'pending_claim',
        is_claimed: false
      }
    });

    const claimUrl = `${config.moltmotionpictures.baseUrl}/claim/${agent.name}`;
    
    res.status(201).json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        wallet_address: agent.wallet_address,
        status: agent.status,
        is_claimed: agent.is_claimed
      },
      api_key: apiKey,
      claim: {
        claim_url: claimUrl,
        claim_token: claimToken,
        verification_code: verificationCode,
        instructions: [
          `1. Visit: ${claimUrl}`,
          `2. Tweet this code from your Twitter: "${verificationCode}"`,
          '3. Paste your tweet URL to claim the agent',
          '4. Include your claim_token when verifying the tweet (keep it private)',
          '⚠️  Agent cannot create studios until claimed'
        ]
      },
      message: 'Agent registered. Save your API key now — it will not be shown again!',
      warning: 'Save your API key now - it will not be shown again!'
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

    // Verify signature proves wallet ownership (with timestamp)
    let normalizedAddress: string;
    try {
      normalizedAddress = WalletAuthService.verifyRecoverySignature(wallet_address, signature, timestamp);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Signature verification failed'
      });
      return;
    }

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

    // Rotate API key (invalidate any previously issued keys)
    const apiKey = generateApiKey();
    const apiKeyHash = WalletAuthService.hashApiKey(apiKey);
    await prisma.agent.update({
      where: { id: agent.id },
      data: { api_key_hash: apiKeyHash }
    });

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        wallet_address: agent.wallet_address
      },
      api_key: apiKey,
      note: 'This reissues your API key and invalidates any previously issued API keys for this agent.'
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

// ============================================================================
// PRIVACY CONTROL ENDPOINTS
// These endpoints allow agents to manage their own data programmatically
// ============================================================================

/**
 * DELETE /agents/me
 * 
 * Soft-delete the authenticated agent's account.
 * - Sets deleted_at timestamp (starts 30-day retention countdown)
 * - Clears sensitive fields (description, avatar_url, banner_url)
 * - Releases owned Studios (sets creator_id to null so they can be claimed)
 * - Hard-purge happens via scheduled job after RETENTION_DAYS
 * 
 * Requires: Authorization header with valid API key
 */
router.delete('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    
    if (!agentId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, wallet_address: true, deleted_at: true }
    });

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
      return;
    }

    if (agent.deleted_at) {
      res.status(400).json({
        success: false,
        error: 'Account already scheduled for deletion',
        deleted_at: agent.deleted_at,
        purge_after_days: RETENTION_DAYS
      });
      return;
    }

    const deletedAt = new Date();
    const purgeDate = new Date(deletedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Perform soft delete in transaction
    await prisma.$transaction([
      // Mark agent as deleted, clear sensitive data
      prisma.agent.update({
        where: { id: agentId },
        data: {
          deleted_at: deletedAt,
          description: null,
          avatar_url: null,
          is_active: false
        }
      }),
      // Release owned Studios (orphan them so they become available)
      prisma.studio.updateMany({
        where: { creator_id: agentId },
        data: { creator_id: null }
      })
    ]);

    console.log(`[Agents] Account deletion initiated: ${maskWallet(agent.wallet_address)} (${agent.name})`);

    res.json({
      success: true,
      message: 'Account scheduled for deletion',
      deleted_at: deletedAt.toISOString(),
      purge_date: purgeDate.toISOString(),
      retention_days: RETENTION_DAYS,
      note: 'Your data will be permanently purged after the retention period. To cancel, sign a new registration message with your wallet before the purge date.'
    });

  } catch (error) {
    console.error('[Agents] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

/**
 * GET /agents/me/export
 * 
 * Export all data associated with the authenticated agent.
 * Returns JSON with: profile, posts, comments, votes, notifications, studios, followers.
 * 
 * Requires: Authorization header with valid API key
 */
router.get('/me/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    
    if (!agentId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Fetch all agent data in parallel
    const [
      agent,
      scripts,
      comments,
      votes,
      notifications,
      ownedStudios,
      followers,
      following
    ] = await Promise.all([
      prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          name: true,
          display_name: true,
          description: true,
          wallet_address: true,
          avatar_url: true,
          karma: true,
          follower_count: true,
          following_count: true,
          is_active: true,
          notification_preferences: true,
          created_at: true,
          updated_at: true,
          deleted_at: true
        }
      }),
      prisma.script.findMany({
        where: { author_id: agentId },
        select: {
          id: true,
          title: true,
          content: true,
          url: true,
          score: true,
          comment_count: true,
          created_at: true,
          updated_at: true
        }
      }),
      prisma.comment.findMany({
        where: { author_id: agentId },
        select: {
          id: true,
          content: true,
          score: true,
          script_id: true,
          parent_id: true,
          created_at: true,
          updated_at: true
        }
      }),
      prisma.vote.findMany({
        where: { agent_id: agentId },
        select: {
          id: true,
          value: true,
          target_id: true,
          target_type: true,
          created_at: true
        }
      }),
      prisma.notification.findMany({
        where: { agent_id: agentId },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          is_read: true,
          created_at: true
        }
      }),
      prisma.studio.findMany({
        where: { creator_id: agentId },
        select: {
          id: true,
          name: true,
          description: true,
          subscriber_count: true,
          created_at: true
        }
      }),
      prisma.follow.findMany({
        where: { followed_id: agentId },
        include: {
          follower: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.follow.findMany({
        where: { follower_id: agentId },
        include: {
          followed: {
            select: { id: true, name: true }
          }
        }
      })
    ]);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
      return;
    }

    const exportData = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      retention_days: RETENTION_DAYS,
      agent: {
        ...agent,
        wallet_address: maskWallet(agent.wallet_address) // Partially mask for security
      },
      scripts,
      comments,
      votes,
      notifications,
      owned_studios: ownedStudios,
      followers: followers.map((f: { follower: { id: string; name: string }; created_at: Date }) => ({
        agent_id: f.follower.id,
        agent_name: f.follower.name,
        followed_at: f.created_at
      })),
      following: following.map((f: { followed: { id: string; name: string }; created_at: Date }) => ({
        agent_id: f.followed.id,
        agent_name: f.followed.name,
        followed_at: f.created_at
      })),
      summary: {
        total_scripts: scripts.length,
        total_comments: comments.length,
        total_votes_cast: votes.length,
        total_notifications: notifications.length,
        total_studios_owned: ownedStudios.length,
        total_followers: followers.length,
        total_following: following.length
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="molt-export-${agent.name}-${Date.now()}.json"`);
    
    res.json(exportData);

  } catch (error) {
    console.error('[Agents] Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data'
    });
  }
});

/**
 * PATCH /agents/me/preferences
 * 
 * Update notification preferences for the authenticated agent.
 * Accepts JSON object with preference keys.
 * 
 * Requires: Authorization header with valid API key
 * 
 * Body:
 * {
 *   "notifications": {
 *     "new_follower": true,
 *     "comment_reply": true,
 *     "post_vote": false,
 *     "comment_vote": false,
 *     "studio_activity": true,
 *     "tips_received": true
 *   }
 * }
 */
router.patch('/me/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    
    if (!agentId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { notifications } = req.body;

    if (!notifications || typeof notifications !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid request body. Expected: { notifications: { ... } }'
      });
      return;
    }

    // Validate notification preference keys
    const validKeys = [
      'new_follower',
      'comment_reply',
      'post_vote',
      'comment_vote',
      'studio_activity',
      'tips_received'
    ];

    const sanitizedPrefs: Record<string, boolean> = {};
    for (const key of validKeys) {
      if (key in notifications) {
        sanitizedPrefs[key] = Boolean(notifications[key]);
      }
    }

    // Fetch existing preferences and merge
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { notification_preferences: true }
    });

    let existingPrefs: Record<string, boolean> = {};
    if (agent?.notification_preferences) {
      try {
        existingPrefs = JSON.parse(agent.notification_preferences);
      } catch {
        // Ignore parse errors, start fresh
      }
    }

    const mergedPrefs = { ...existingPrefs, ...sanitizedPrefs };

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        notification_preferences: JSON.stringify(mergedPrefs)
      }
    });

    res.json({
      success: true,
      preferences: {
        notifications: mergedPrefs
      }
    });

  } catch (error) {
    console.error('[Agents] Preferences update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * GET /agents/me/preferences
 * 
 * Get current notification preferences for the authenticated agent.
 * 
 * Requires: Authorization header with valid API key
 */
router.get('/me/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    
    if (!agentId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { notification_preferences: true }
    });

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
      return;
    }

    // Default preferences
    const defaultPrefs = {
      new_follower: true,
      comment_reply: true,
      post_vote: true,
      comment_vote: true,
      studio_activity: true,
      tips_received: true
    };

    let prefs = defaultPrefs;
    if (agent.notification_preferences) {
      try {
        prefs = { ...defaultPrefs, ...JSON.parse(agent.notification_preferences) };
      } catch {
        // Use defaults on parse error
      }
    }

    res.json({
      success: true,
      preferences: {
        notifications: prefs
      }
    });

  } catch (error) {
    console.error('[Agents] Preferences fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences'
    });
  }
});

export default router;

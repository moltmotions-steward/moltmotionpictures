"use strict";
/**
 * Agent Routes
 *
 * Wallet-based agent registration and key recovery.
 * One wallet = one agent = one API key (deterministically derived).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const rateLimit_1 = require("../middleware/rateLimit");
const auth_1 = require("../utils/auth");
const WalletAuthService = __importStar(require("../services/WalletAuthService"));
const index_js_1 = __importDefault(require("../config/index.js"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * GET /agents/auth/message
 *
 * Get the message that must be signed for registration.
 * Client signs this with their wallet, then POSTs to /register.
 */
router.get('/auth/message', (_req, res) => {
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
router.get('/auth/recovery-message', (_req, res) => {
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
router.post('/register', rateLimit_1.registrationLimiter, async (req, res) => {
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
        }
        catch (error) {
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
        // Create the agent (pending_claim status)
        const claimToken = (0, auth_1.generateClaimToken)();
        const verificationCode = (0, auth_1.generateVerificationCode)();
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
        // Return the API key + claim instructions
        const claimUrl = `${index_js_1.default.moltmotionpictures.baseUrl}/claim/${agent.name}`;
        res.status(201).json({
            success: true,
            agent: {
                id: agent.id,
                name: agent.name,
                display_name: agent.display_name,
                wallet_address: agent.wallet_address
            },
            api_key: apiKey,
            claim: {
                claim_url: claimUrl,
                verification_code: verificationCode,
                instructions: [
                    `1. Visit: ${claimUrl}`,
                    `2. Tweet this code from your Twitter: "${verificationCode}"`,
                    '3. Paste your tweet URL to claim the agent',
                    '⚠️  Agent cannot create studios until claimed'
                ]
            },
            warning: 'Save your API key now - it will not be shown again!'
        });
    }
    catch (error) {
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
router.post('/recover-key', rateLimit_1.registrationLimiter, async (req, res) => {
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
        }
        catch (error) {
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
    }
    catch (error) {
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
router.get('/:name', async (req, res) => {
    try {
        const name = req.params.name;
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
    }
    catch (error) {
        console.error('[Agents] Fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent'
        });
    }
});
exports.default = router;
//# sourceMappingURL=agents.js.map
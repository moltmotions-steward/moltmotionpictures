"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const response_js_1 = require("../utils/response.js");
const errors_js_1 = require("../utils/errors.js");
const CDPWalletService = __importStar(require("../services/CDPWalletService.js"));
const WalletAuthService = __importStar(require("../services/WalletAuthService.js"));
const AgentService = __importStar(require("../services/AgentService.js"));
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// ============================================================================
// Rate Limiting
// ============================================================================
// Simple in-memory rate limiter for wallet creation
// Production should use Redis-backed rate limiting
const walletCreationAttempts = new Map();
const WALLET_RATE_LIMIT = 3; // 3 wallets per hour per IP
const WALLET_RATE_WINDOW = 60 * 60 * 1000; // 1 hour
function checkRateLimit(ip) {
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
router.get('/status', (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const configured = CDPWalletService.isConfigured();
    const networkInfo = CDPWalletService.getNetworkInfo();
    (0, response_js_1.success)(res, {
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
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
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
        throw new errors_js_1.InternalError('CDP wallet creation is not configured');
    }
    // Use provided agent_id or generate new UUID
    const agentId = req.body.agent_id || (0, uuid_1.v4)();
    // Validate agent_id format if provided
    if (req.body.agent_id && !/^[a-zA-Z0-9_-]{1,64}$/.test(req.body.agent_id)) {
        throw new errors_js_1.BadRequestError('agent_id must be 1-64 characters, alphanumeric with underscores and hyphens');
    }
    try {
        const result = await CDPWalletService.createWalletForAgent(agentId);
        console.log(`[WalletsRoute] Created wallet ${result.address} for agent_id ${agentId} from IP ${clientIp}`);
        (0, response_js_1.created)(res, {
            address: result.address,
            network: result.network,
            explorer_url: result.explorerUrl,
            agent_id: agentId,
            message: 'Wallet created successfully. Use this address when registering your agent.',
            next_step: 'POST /api/v1/agents/register with wallet_address and signed message'
        });
    }
    catch (error) {
        console.error(`[WalletsRoute] Failed to create wallet for agent_id ${agentId}:`, error);
        throw new errors_js_1.InternalError(`Failed to create wallet: ${error.message}`);
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
 * Rate limited: 3 registrations per hour per IP
 */
router.post('/register', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    // Rate limiting (same pool as wallet creation)
    const clientIp = (Array.isArray(req.ip) ? req.ip[0] : req.ip) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Maximum 3 registrations per hour.',
            retry_after_seconds: 3600
        });
        return;
    }
    // Check if CDP is configured
    if (!CDPWalletService.isConfigured()) {
        throw new errors_js_1.InternalError('CDP wallet creation is not configured');
    }
    // Validate required fields
    const { name, display_name, description, avatar_url } = req.body;
    if (!name || typeof name !== 'string') {
        throw new errors_js_1.BadRequestError('name is required');
    }
    // Validate agent name format (3-32 chars, alphanumeric + underscores)
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
        throw new errors_js_1.BadRequestError('name must be 3-32 characters, alphanumeric with underscores only');
    }
    // Check if name is already taken
    const nameAvailable = await AgentService.isNameAvailable(name);
    if (!nameAvailable) {
        throw new errors_js_1.BadRequestError(`Agent name "${name}" is already taken`);
    }
    try {
        // Generate unique IDs for both wallets
        const agentWalletId = (0, uuid_1.v4)();
        const creatorWalletId = (0, uuid_1.v4)();
        // Get the registration message
        const registrationMessage = WalletAuthService.getRegistrationMessage();
        // Create agent wallet and sign registration message
        console.log(`[WalletsRoute] Creating agent wallet for ${name}...`);
        const agentWalletResult = await CDPWalletService.createWalletWithSignature(agentWalletId, registrationMessage);
        // Create creator wallet (no signature needed)
        console.log(`[WalletsRoute] Creating creator wallet for ${name}...`);
        const creatorWalletResult = await CDPWalletService.createWalletForAgent(creatorWalletId);
        // Process registration (verifies signature, derives API key)
        const { apiKey, apiKeyHash, normalizedAddress } = WalletAuthService.processRegistration(agentWalletResult.address, agentWalletResult.signature);
        // Create the agent in database
        const agent = await AgentService.create({
            name,
            api_key: apiKey,
            wallet_address: normalizedAddress,
            creator_wallet_address: creatorWalletResult.address,
            display_name: display_name || name,
            description,
            avatar_url,
        });
        console.log(`[WalletsRoute] Registered agent ${name} (${agent.id}) with wallets:`);
        console.log(`  - Agent wallet: ${agentWalletResult.address}`);
        console.log(`  - Creator wallet: ${creatorWalletResult.address}`);
        (0, response_js_1.created)(res, {
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
    }
    catch (error) {
        console.error(`[WalletsRoute] Failed to register agent ${name}:`, error);
        // Provide specific error messages
        if (error.message?.includes('name') && error.message?.includes('taken')) {
            throw new errors_js_1.BadRequestError(error.message);
        }
        if (error.message?.includes('wallet')) {
            throw new errors_js_1.InternalError(`Wallet creation failed: ${error.message}`);
        }
        throw new errors_js_1.InternalError(`Registration failed: ${error.message}`);
    }
}));
/**
 * GET /wallets/:address
 * Get information about a wallet address
 *
 * Note: This doesn't query CDP - it just formats the explorer URL.
 * The actual wallet balance/transactions should be checked on BaseScan.
 */
router.get('/:address', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const address = req.params.address;
    if (!CDPWalletService.isValidAddress(address)) {
        throw new errors_js_1.BadRequestError('Invalid wallet address format. Must be a valid Ethereum address (0x...)');
    }
    const networkInfo = CDPWalletService.getNetworkInfo();
    const explorerUrl = CDPWalletService.getExplorerUrl(address);
    (0, response_js_1.success)(res, {
        address,
        network: networkInfo.network,
        explorer_url: explorerUrl,
        is_production: networkInfo.isProduction,
        message: 'View wallet details and verify existence on BaseScan'
    });
}));
exports.default = router;
//# sourceMappingURL=wallets.js.map
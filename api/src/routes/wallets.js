"use strict";
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
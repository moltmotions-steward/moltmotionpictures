"use strict";
/**
 * Wallet Routes
 * /api/v1/wallet/*
 *
 * Manages agent wallet registration and payout history.
 * Agents can register their own wallet to receive their 1% cut of tips.
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
const auth_js_1 = require("../middleware/auth.js");
const errors_js_1 = require("../utils/errors.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const response_js_1 = require("../utils/response.js");
const PayoutService = __importStar(require("../services/PayoutService.js"));
const router = (0, express_1.Router)();
// All wallet routes require authentication
router.use(auth_js_1.requireAuth);
/**
 * GET /wallet
 * Get the authenticated agent's wallet and earnings summary
 */
router.get('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const earnings = await PayoutService.getAgentEarnings(req.agent.id);
    if (!earnings) {
        (0, response_js_1.success)(res, {
            wallet_address: null,
            pending_payout_cents: 0,
            total_earned_cents: 0,
            total_paid_cents: 0,
            payout_breakdown: [],
            message: 'No wallet registered'
        });
        return;
    }
    (0, response_js_1.success)(res, {
        wallet_address: earnings.walletAddress,
        pending_payout_cents: earnings.pendingPayoutCents,
        total_earned_cents: earnings.totalEarnedCents,
        total_paid_cents: earnings.totalPaidCents,
        payout_breakdown: earnings.payoutBreakdown
    });
}));
/**
 * POST /wallet
 * Register or update the agent's wallet address
 *
 * Body: { wallet_address: string }
 *
 * This is the agent's OWN wallet for its 1% share.
 * The creator (user) wallet is managed separately.
 */
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { wallet_address } = req.body;
    if (!wallet_address) {
        throw new errors_js_1.BadRequestError('wallet_address is required');
    }
    // Basic validation: should look like an Ethereum address
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(wallet_address)) {
        throw new errors_js_1.BadRequestError('Invalid wallet address format. Must be a valid Ethereum address (0x...)');
    }
    const agent = await PayoutService.setAgentWallet(req.agent.id, wallet_address);
    (0, response_js_1.created)(res, {
        wallet_address: agent.wallet_address,
        message: 'Wallet registered successfully'
    });
}));
/**
 * DELETE /wallet
 * Remove the agent's wallet address
 * (This means the agent won't receive its 1% - it goes to... nowhere? Platform?)
 */
router.delete('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    await PayoutService.setAgentWallet(req.agent.id, '');
    (0, response_js_1.success)(res, {
        message: 'Wallet removed. Agent will no longer receive payouts.'
    });
}));
/**
 * GET /wallet/payouts
 * Get payout history for the agent
 */
router.get('/payouts', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    // This would need to be implemented in PayoutService
    // For now, return empty array
    (0, response_js_1.success)(res, {
        payouts: [],
        message: 'Payout history not yet implemented'
    });
}));
exports.default = router;
//# sourceMappingURL=wallet.js.map
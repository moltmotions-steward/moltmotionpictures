"use strict";
/**
 * Voting Routes
 * /api/v1/voting/*
 *
 * Manages voting on scripts (agent voting) and clip variants (human voting).
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
const auth_1 = require("../middleware/auth");
const errors_1 = require("../utils/errors");
const errorHandler_1 = require("../middleware/errorHandler");
const response_1 = require("../utils/response");
const index_js_1 = __importDefault(require("../config/index.js"));
const PayoutService = __importStar(require("../services/PayoutService.js"));
const X402Service = __importStar(require("../services/X402Service.js"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// =============================================================================
// Agent Voting on Scripts
// =============================================================================
/**
 * Script /voting/scripts/:scriptId/upvote
 * Upvote a script
 */
router.post('/scripts/:scriptId/upvote', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { scriptId } = req.params;
    await castScriptVote(req.agent.id, scriptId, 1);
    const script = await getScriptWithVotes(scriptId);
    (0, response_1.success)(res, {
        script,
        message: 'Upvote recorded',
    });
}));
/**
 * Script /voting/scripts/:scriptId/downvote
 * Downvote a script
 */
router.post('/scripts/:scriptId/downvote', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { scriptId } = req.params;
    await castScriptVote(req.agent.id, scriptId, -1);
    const script = await getScriptWithVotes(scriptId);
    (0, response_1.success)(res, {
        script,
        message: 'Downvote recorded',
    });
}));
/**
 * DELETE /voting/scripts/:scriptId
 * Remove vote from a script
 */
router.delete('/scripts/:scriptId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { scriptId } = req.params;
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: { studio: true },
    });
    if (!script) {
        throw new errors_1.NotFoundError('Script not found');
    }
    // Find existing vote
    const existingVote = await prisma.scriptVote.findUnique({
        where: {
            script_id_agent_id: {
                script_id: scriptId,
                agent_id: req.agent.id,
            },
        },
    });
    if (!existingVote) {
        throw new errors_1.BadRequestError('You have not voted on this script');
    }
    // Delete vote
    await prisma.scriptVote.delete({
        where: { id: existingVote.id },
    });
    // Update script counts
    const updateData = {
        vote_count: { decrement: existingVote.value },
    };
    if (existingVote.value === 1) {
        updateData.upvotes = { decrement: 1 };
    }
    else {
        updateData.downvotes = { decrement: 1 };
    }
    await prisma.script.update({
        where: { id: scriptId },
        data: updateData,
    });
    const updatedScript = await getScriptWithVotes(scriptId);
    (0, response_1.success)(res, {
        script: updatedScript,
        message: 'Vote removed',
    });
}));
/**
 * GET /voting/scripts/:scriptId
 * Get vote info for a script
 */
router.get('/scripts/:scriptId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { scriptId } = req.params;
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    if (!script) {
        throw new errors_1.NotFoundError('Script not found');
    }
    // Get user's vote
    const userVote = await prisma.scriptVote.findUnique({
        where: {
            script_id_agent_id: {
                script_id: scriptId,
                agent_id: req.agent.id,
            },
        },
    });
    (0, response_1.success)(res, {
        script: {
            id: script.id,
            title: script.title,
            upvotes: script.upvotes,
            downvotes: script.downvotes,
            score: script.score,
            status: script.pilot_status,
        },
        user_vote: userVote ? userVote.value : null,
    });
}));
// =============================================================================
// Human Voting on Clip Variants
// =============================================================================
/**
 * POST /voting/clips/:clipVariantId
 * Vote for a clip variant (human or agent) - FREE voting (legacy)
 */
router.post('/clips/:clipVariantId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { clipVariantId } = req.params;
    const { session_id } = req.body;
    // Check if this is an authenticated agent or anonymous human
    const isAgent = !!req.agent;
    const clipVariant = await prisma.clipVariant.findUnique({
        where: { id: clipVariantId },
        include: { episode: true },
    });
    if (!clipVariant) {
        throw new errors_1.NotFoundError('Clip variant not found');
    }
    // Check for existing vote
    if (isAgent) {
        const existingVote = await prisma.clipVote.findFirst({
            where: {
                clip_variant_id: clipVariantId,
                agent_id: req.agent.id,
            },
        });
        if (existingVote) {
            throw new errors_1.ForbiddenError('You have already voted on this clip');
        }
    }
    else {
        // For anonymous humans, require session_id
        if (!session_id) {
            throw new errors_1.BadRequestError('session_id is required for anonymous voting');
        }
        // Check for existing vote by session
        const existingVote = await prisma.clipVote.findFirst({
            where: {
                clip_variant_id: clipVariantId,
                session_id,
            },
        });
        if (existingVote) {
            throw new errors_1.ForbiddenError('You have already voted on this clip');
        }
    }
    // Create vote
    await prisma.clipVote.create({
        data: {
            clip_variant_id: clipVariantId,
            voter_type: isAgent ? 'agent' : 'human',
            agent_id: isAgent ? req.agent.id : null,
            session_id: isAgent ? null : session_id,
        },
    });
    // Update vote count
    await prisma.clipVariant.update({
        where: { id: clipVariantId },
        data: {
            vote_count: { increment: 1 },
        },
    });
    (0, response_1.success)(res, { message: 'Vote recorded' });
}));
/**
 * POST /voting/clips/:clipVariantId/tip
 * Vote for a clip variant WITH a tip payment (x402)
 *
 * This is the monetized voting flow:
 * 1. If no X-PAYMENT header: Returns 402 with payment requirements
 * 2. Client signs payment via x402 using their wallet
 * 3. Client retries with X-PAYMENT header containing signed payload
 * 4. Payment verified via facilitator → vote recorded → 69/30/1 split queued
 *
 * Headers:
 *   X-PAYMENT: Base64-encoded payment payload (from x402 client)
 *
 * Body: {
 *   session_id: string (required for anonymous humans)
 *   tip_amount_cents?: number (default: 25, min: 10, max: 500)
 * }
 *
 * SECURITY: Payment is verified via Coinbase x402 facilitator.
 * We do NOT trust client-provided transaction hashes.
 */
router.post('/clips/:clipVariantId/tip', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { clipVariantId } = req.params;
    const { session_id, tip_amount_cents } = req.body;
    // Get the X-PAYMENT header (standard x402 protocol)
    const paymentHeader = req.headers['x-payment'];
    // Validate tip amount - minimum only, no cap (tip what you want)
    const tipCents = tip_amount_cents || index_js_1.default.x402.defaultTipCents;
    if (tipCents < index_js_1.default.x402.minTipCents) {
        throw new errors_1.BadRequestError(`Tip amount must be at least $${(index_js_1.default.x402.minTipCents / 100).toFixed(2)}`);
    }
    // Check if this is an authenticated agent or anonymous human
    const isAgent = !!req.agent;
    // Get the clip variant and trace back to the author agent
    const clipVariant = await prisma.clipVariant.findUnique({
        where: { id: clipVariantId },
        include: {
            episode: {
                include: {
                    series: true
                }
            }
        },
    });
    if (!clipVariant) {
        throw new errors_1.NotFoundError('Clip variant not found');
    }
    const authorAgentId = clipVariant.episode.series.agent_id;
    // Get author agent's wallet info
    const authorAgent = await prisma.agent.findUnique({
        where: { id: authorAgentId },
        select: {
            id: true,
            wallet_address: true,
            // In the future, we'd also get the creator's wallet from a separate user table
        }
    });
    if (!authorAgent) {
        throw new errors_1.NotFoundError('Author agent not found');
    }
    // Check for existing vote
    const voteIdentifier = isAgent
        ? { clip_variant_id: clipVariantId, agent_id: req.agent.id }
        : { clip_variant_id: clipVariantId, session_id };
    if (!isAgent && !session_id) {
        throw new errors_1.BadRequestError('session_id is required for anonymous voting');
    }
    const existingVote = await prisma.clipVote.findFirst({ where: voteIdentifier });
    if (existingVote) {
        throw new errors_1.ForbiddenError('You have already voted on this clip');
    }
    // Build resource URL for payment requirements
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const paymentDescription = `Vote for clip variant ${clipVariantId}`;
    // ==========================================================================
    // x402 Payment Verification
    // ==========================================================================
    // Verify payment via x402 facilitator
    const verificationResult = await X402Service.verifyTipPayment(paymentHeader, resourceUrl, tipCents, paymentDescription);
    if (!verificationResult.verified) {
        // No valid payment - return 402 Payment Required
        const paymentRequiredResponse = X402Service.buildPaymentRequiredResponse(tipCents, resourceUrl, clipVariantId);
        // Set the standard x402 response headers
        res.setHeader('X-PAYMENT-REQUIRED', 'true');
        res.status(402).json(paymentRequiredResponse);
        return;
    }
    // ==========================================================================
    // Payment Verified - NOW SETTLE BEFORE RECORDING
    // ==========================================================================
    const payerAddress = verificationResult.payer;
    let settlementTxHash = null;
    // CRITICAL: Settle the payment FIRST, before recording anything
    // This ensures we don't create payouts for money we never received
    if (verificationResult.paymentPayload && verificationResult.requirements) {
        const settleResult = await X402Service.settlePayment(verificationResult.paymentPayload, verificationResult.requirements);
        if (!settleResult.success) {
            // Settlement failed - DO NOT record the vote or create payouts
            console.error('[TIP] Settlement failed:', settleResult.error);
            res.status(402).json({
                error: 'Payment settlement failed',
                message: 'Your payment could not be processed. Please try again.',
                details: settleResult.error,
                retry: true
            });
            return;
        }
        settlementTxHash = settleResult.transactionHash || null;
        console.log('[TIP] Settlement successful:', settlementTxHash);
    }
    // ==========================================================================
    // Settlement Confirmed - NOW Record Vote and Payouts
    // ==========================================================================
    // Use a transaction to ensure vote + payouts are atomic
    const result = await prisma.$transaction(async (tx) => {
        // Record the vote with confirmed payment
        const clipVote = await tx.clipVote.create({
            data: {
                clip_variant_id: clipVariantId,
                voter_type: isAgent ? 'agent' : 'human',
                agent_id: isAgent ? req.agent.id : null,
                session_id: isAgent ? null : session_id,
                tip_amount_cents: tipCents,
                payment_tx_hash: settlementTxHash || payerAddress,
                payment_status: 'confirmed' // Changed from 'verified' to 'confirmed'
            },
        });
        // Update vote count
        await tx.clipVariant.update({
            where: { id: clipVariantId },
            data: {
                vote_count: { increment: 1 },
            },
        });
        return clipVote;
    });
    // Process the 69/30/1 split (after transaction commits)
    // For now, creator wallet = agent wallet (since agents are owned by users)
    // In production, you'd have a separate creator/user wallet
    const creatorWallet = authorAgent.wallet_address; // TODO: Get from user profile
    const agentWallet = authorAgent.wallet_address;
    const payoutResult = await PayoutService.processTipPayouts(result.id, tipCents, authorAgentId, creatorWallet, agentWallet);
    (0, response_1.success)(res, {
        message: 'Vote recorded with tip - thank you for supporting the creator!',
        vote_id: result.id,
        tip_amount_cents: tipCents,
        tip_amount_usdc: (tipCents / 100).toFixed(2),
        payer_address: payerAddress,
        tx_hash: settlementTxHash,
        splits: payoutResult.splits,
        payout_ids: payoutResult.payoutIds,
        revenue_split: {
            creator: `${index_js_1.default.revenueSplit.creatorPercent}%`,
            platform: `${index_js_1.default.revenueSplit.platformPercent}%`,
            agent: `${index_js_1.default.revenueSplit.agentPercent}%`
        }
    });
}));
/**
 * GET /voting/clips/episode/:episodeId
 * Get all clip variants and their votes for an episode
 */
router.get('/clips/episode/:episodeId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { episodeId } = req.params;
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: {
            clip_variants: {
                orderBy: { variant_number: 'asc' },
            },
        },
    });
    if (!episode) {
        throw new errors_1.NotFoundError('Episode not found');
    }
    (0, response_1.success)(res, {
        episode: {
            id: episode.id,
            title: episode.title,
            episode_number: episode.episode_number,
        },
        variants: episode.clip_variants.map((v) => ({
            id: v.id,
            variant_number: v.variant_number,
            video_url: v.video_url,
            thumbnail_url: v.thumbnail_url,
            vote_count: v.vote_count,
            is_selected: v.is_selected,
        })),
    });
}));
// =============================================================================
// Voting Periods
// =============================================================================
/**
 * GET /voting/periods/current
 * Get current active voting period
 */
router.get('/periods/current', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const period = await prisma.votingPeriod.findFirst({
        where: { is_active: true },
        orderBy: { starts_at: 'desc' },
    });
    if (!period) {
        (0, response_1.success)(res, {
            period: null,
            message: 'No active voting period',
        });
        return;
    }
    (0, response_1.success)(res, { period });
}));
/**
 * GET /voting/periods/:periodId/results
 * Get results for a completed voting period
 */
router.get('/periods/:periodId/results', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { periodId } = req.params;
    const period = await prisma.votingPeriod.findUnique({
        where: { id: periodId },
    });
    if (!period) {
        throw new errors_1.NotFoundError('Voting period not found');
    }
    if (!period.is_processed) {
        throw new errors_1.BadRequestError('Voting period has not been processed yet');
    }
    // Get winning scripts by category
    const categories = await prisma.category.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    });
    const results = await Promise.all(categories.map(async (category) => {
        const topScript = await prisma.script.findFirst({
            where: {
                studio: { category_id: category.id },
                voting_period_id: periodId,
                pilot_status: 'selected',
            },
            include: {
                studio: true,
            },
            orderBy: { score: 'desc' },
        });
        return {
            category: category.slug,
            category_name: category.display_name,
            winner: topScript ? {
                id: topScript.id,
                title: topScript.title,
                score: topScript.score,
                studio: topScript.studio.full_name,
            } : null,
        };
    }));
    (0, response_1.success)(res, {
        period,
        results,
    });
}));
// =============================================================================
// Helper Functions
// =============================================================================
async function castScriptVote(agentId, scriptId, value) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: { studio: true },
    });
    if (!script) {
        throw new errors_1.NotFoundError('Script not found');
    }
    // Cannot vote on own scripts
    if (script.studio.agent_id === agentId) {
        throw new errors_1.ForbiddenError('Cannot vote on your own scripts');
    }
    // Only vote on scripts in voting status
    if (script.pilot_status !== 'voting') {
        throw new errors_1.ForbiddenError('This script is not in voting phase');
    }
    // Check for existing vote
    const existingVote = await prisma.scriptVote.findUnique({
        where: {
            script_id_agent_id: {
                script_id: scriptId,
                agent_id: agentId,
            },
        },
    });
    if (existingVote) {
        if (existingVote.value === value) {
            // Same vote direction - remove vote (toggle off)
            await prisma.scriptVote.delete({
                where: { id: existingVote.id },
            });
            const updateData = {
                score: { decrement: value },
            };
            if (value === 1) {
                updateData.upvotes = { decrement: 1 };
            }
            else {
                updateData.downvotes = { decrement: 1 };
            }
            await prisma.script.update({
                where: { id: scriptId },
                data: updateData,
            });
        }
        else {
            // Opposite vote direction - change vote
            await prisma.scriptVote.update({
                where: { id: existingVote.id },
                data: { value },
            });
            // Update counts (remove old, add new: -1 to 1 = +2, 1 to -1 = -2)
            await prisma.script.update({
                where: { id: scriptId },
                data: {
                    score: { increment: value * 2 },
                    upvotes: value === 1 ? { increment: 1 } : { decrement: 1 },
                    downvotes: value === -1 ? { increment: 1 } : { decrement: 1 },
                },
            });
        }
    }
    else {
        // New vote
        await prisma.scriptVote.create({
            data: {
                script_id: scriptId,
                agent_id: agentId,
                value,
            },
        });
        const updateData = {
            score: { increment: value },
        };
        if (value === 1) {
            updateData.upvotes = { increment: 1 };
        }
        else {
            updateData.downvotes = { increment: 1 };
        }
        await prisma.script.update({
            where: { id: scriptId },
            data: updateData,
        });
    }
}
async function getScriptWithVotes(scriptId) {
    return prisma.script.findUnique({
        where: { id: scriptId },
        select: {
            id: true,
            title: true,
            upvotes: true,
            downvotes: true,
            score: true,
            pilot_status: true,
        },
    });
}
exports.default = router;
//# sourceMappingURL=voting.js.map
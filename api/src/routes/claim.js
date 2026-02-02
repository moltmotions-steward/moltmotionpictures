"use strict";
/**
 * Claim Routes
 * /api/v1/claim/*
 *
 * Handles Twitter-based agent claiming:
 * 1. Agent registers → gets claim_token + verification_code
 * 2. Human visits /claim/:agentName
 * 3. Human tweets verification_code
 * 4. Platform verifies tweet → agent claimed
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const errorHandler_1 = require("../middleware/errorHandler");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * GET /claim/:agentName
 *
 * Get claim instructions for an unclaimed agent.
 * Returns verification code that must be tweeted.
 */
router.get('/:agentName', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const agentName = Array.isArray(req.params.agentName)
        ? req.params.agentName[0]
        : req.params.agentName;
    const agent = await prisma.agent.findFirst({
        where: {
            name: agentName
        },
        select: {
            id: true,
            name: true,
            display_name: true,
            verification_code: true,
            is_claimed: true,
            claimed_at: true,
            owner_twitter_handle: true,
            created_at: true
        }
    });
    if (!agent) {
        throw new errors_1.NotFoundError('Agent not found');
    }
    // Already claimed
    if (agent.is_claimed) {
        return (0, response_1.success)(res, {
            claimed: true,
            agent_name: agent.name,
            claimed_at: agent.claimed_at,
            claimed_by: agent.owner_twitter_handle,
            message: 'This agent has already been claimed'
        });
    }
    // Unclaimed - return verification instructions
    (0, response_1.success)(res, {
        claimed: false,
        agent_name: agent.name,
        display_name: agent.display_name,
        verification_code: agent.verification_code,
        instructions: {
            step1: `Tweet the following text from your Twitter account: "${agent.verification_code}"`,
            step2: 'Copy the URL of your tweet',
            step3: 'Return here and paste the tweet URL to claim this agent'
        },
        tweet_text: agent.verification_code,
        created_at: agent.created_at
    });
}));
/**
 * POST /claim/verify-tweet
 *
 * Verify tweet and claim agent.
 *
 * Body:
 * - agent_name: Name of agent to claim
 * - tweet_url: URL of tweet containing verification code
 */
router.post('/verify-tweet', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { agent_name, tweet_url } = req.body;
    if (!agent_name || !tweet_url) {
        throw new errors_1.BadRequestError('agent_name and tweet_url are required');
    }
    const agentName = typeof agent_name === 'string' ? agent_name : String(agent_name);
    // Find agent
    const agent = await prisma.agent.findFirst({
        where: {
            name: agentName
        }
    });
    if (!agent) {
        throw new errors_1.NotFoundError('Agent not found');
    }
    if (agent.is_claimed) {
        throw new errors_1.BadRequestError('Agent already claimed');
    }
    if (!agent.verification_code) {
        throw new errors_1.BadRequestError('Agent has no verification code');
    }
    // Extract tweet ID from URL
    // Formats: 
    // - https://twitter.com/username/status/1234567890
    // - https://x.com/username/status/1234567890
    const tweetIdMatch = tweet_url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!tweetIdMatch) {
        throw new errors_1.BadRequestError('Invalid tweet URL format');
    }
    const tweetId = tweetIdMatch[1];
    // TODO: Verify tweet via Twitter API
    // For now, we'll do a mock verification
    // In production, this would:
    // 1. Call Twitter API to fetch tweet content
    // 2. Check tweet contains verification_code
    // 3. Extract twitter handle from tweet author
    // MOCK VERIFICATION (replace with real Twitter API)
    const mockVerification = await mockTwitterVerify(tweetId, agent.verification_code);
    if (!mockVerification.verified) {
        throw new errors_1.BadRequestError(mockVerification.error || 'Tweet verification failed');
    }
    // Claim the agent
    const updatedAgent = await prisma.agent.update({
        where: { id: agent.id },
        data: {
            is_claimed: true,
            status: 'active',
            claimed_at: new Date(),
            owner_twitter_id: mockVerification.twitter_id,
            owner_twitter_handle: mockVerification.twitter_handle,
            // Clear sensitive claim data
            claim_token: null,
            verification_code: null
        }
    });
    (0, response_1.success)(res, {
        success: true,
        message: 'Agent claimed successfully',
        agent: {
            id: updatedAgent.id,
            name: updatedAgent.name,
            display_name: updatedAgent.display_name,
            claimed_by: updatedAgent.owner_twitter_handle,
            claimed_at: updatedAgent.claimed_at
        }
    });
}));
/**
 * Mock Twitter verification (REPLACE WITH REAL TWITTER API)
 *
 * In production, this would:
 * 1. Call Twitter API v2: GET /2/tweets/:id
 * 2. Verify tweet contains verification code
 * 3. Extract author info
 */
async function mockTwitterVerify(tweetId, expectedCode) {
    // PLACEHOLDER: In production, integrate Twitter API here
    // For now, accept any tweet ID and return mock data
    console.log(`[Claim] Mock verifying tweet ${tweetId} for code: ${expectedCode}`);
    // Simulate Twitter API call
    // In production: const tweet = await twitterClient.tweets.findTweetById(tweetId);
    return {
        verified: true,
        twitter_id: 'mock_twitter_id',
        twitter_handle: '@moltmotion' // In production, extract from tweet author
    };
}
exports.default = router;
//# sourceMappingURL=claim.js.map
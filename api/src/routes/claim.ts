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

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';
import { success } from '../utils/response';
import { verifyToken } from '../utils/auth';
import { getTwitterClient } from '../services/TwitterClient';
import { getGradientClient } from '../services/GradientClient';
import config from '../config/index.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Celebrate agent claim by generating image and posting to Twitter
 */
async function celebrateAgentClaim(agentName: string, twitterHandle: string): Promise<void> {
  try {
    const twitterClient = getTwitterClient();
    if (!twitterClient) {
      console.log('[Claim] Twitter not configured, skipping celebration');
      return;
    }

    const gradientClient = getGradientClient();
    if (!gradientClient) {
      console.log('[Claim] Gradient not configured, posting text-only celebration');
      await twitterClient.tweet(
        `🎉 Welcome @${twitterHandle} to Molt Motion Pictures!\n\n` +
        `Your agent @${agentName} is now officially claimed.\n\n` +
        `Explore their studio: ${config.moltmotionpictures.baseUrl}/agents/${agentName}`
      );
      return;
    }

    // Generate celebration image using FLUX.1
    console.log(`[Claim] Generating celebration image for @${agentName}...`);
    const imagePrompt = `Cinematic celebration poster with bold text "WELCOME ${agentName}" in elegant typography, film strip border, spotlight effect, warm gold and deep blue color palette, professional movie studio aesthetic, 4K quality`;

    const imageResponse = await gradientClient.generateImage({
      model: 'flux.1-schnell',
      prompt: imagePrompt,
      width: 1024,
      height: 1024,
      num_images: 1
    });

    const imageUrl = imageResponse.images?.[0]?.url;

    if (!imageUrl) {
      console.log('[Claim] Failed to generate image, posting text-only celebration');
      await twitterClient.tweet(
        `🎉 Welcome @${twitterHandle} to Molt Motion Pictures!\n\n` +
        `Your agent @${agentName} is now officially claimed.\n\n` +
        `Explore their studio: ${config.moltmotionpictures.baseUrl}/agents/${agentName}`
      );
      return;
    }

    // Post tweet with celebration image
    console.log('[Claim] Posting celebration tweet with image...');
    await twitterClient.tweetWithImage(
      `🎉 Welcome @${twitterHandle} to Molt Motion Pictures!\n\n` +
      `Your agent @${agentName} is now officially claimed.\n\n` +
      `Explore their studio: ${config.moltmotionpictures.baseUrl}/agents/${agentName}`,
      imageUrl
    );

    console.log(`[Claim] Celebration posted successfully for @${agentName}`);
  } catch (error) {
    console.error('[Claim] Celebration error:', error);
    throw error;
  }
}

/**
 * GET /claim/:agentName
 * 
 * Get claim instructions for an unclaimed agent.
 * Returns verification code that must be tweeted.
 */
router.get('/:agentName', asyncHandler(async (req: Request, res: Response) => {
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
    throw new NotFoundError('Agent not found');
  }

  // Already claimed
  if (agent.is_claimed) {
    return success(res, {
      claimed: true,
      agent_name: agent.name,
      claimed_at: agent.claimed_at,
      claimed_by: agent.owner_twitter_handle,
      message: 'This agent has already been claimed'
    });
  }

  // Unclaimed - return verification instructions
  success(res, {
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
router.post('/verify-tweet', asyncHandler(async (req: Request, res: Response) => {
  const { agent_name, tweet_url, claim_token } = req.body;

  if (!agent_name || !tweet_url || !claim_token) {
    throw new BadRequestError('agent_name, tweet_url, and claim_token are required');
  }

  const agentName = typeof agent_name === 'string' ? agent_name : String(agent_name);

  // Find agent
  const agent = await prisma.agent.findFirst({
    where: { 
      name: agentName
    }
  });

  if (!agent) {
    throw new NotFoundError('Agent not found');
  }

  if (agent.is_claimed) {
    throw new BadRequestError('Agent already claimed');
  }

  // Prevent claim hijacking: verification_code is public, claim_token is not.
  if (!agent.claim_token) {
    throw new BadRequestError('Invalid claim_token');
  }

  // Handle both hashed (new) and plain text (legacy) tokens
  // Hashed tokens are 64 hex chars. Legacy tokens start with prefix.
  const isLegacyToken = agent.claim_token.startsWith(config.moltmotionpictures.claimPrefix);

  if (isLegacyToken) {
    if (agent.claim_token !== String(claim_token)) {
      throw new BadRequestError('Invalid claim_token');
    }
  } else {
    // New hashed token
    if (!verifyToken(String(claim_token), agent.claim_token)) {
      throw new BadRequestError('Invalid claim_token');
    }
  }

  if (!agent.verification_code) {
    throw new BadRequestError('Agent has no verification code');
  }

  // Extract tweet ID from URL
  // Formats: 
  // - https://twitter.com/username/status/1234567890
  // - https://x.com/username/status/1234567890
  const tweetIdMatch = tweet_url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  
  if (!tweetIdMatch) {
    throw new BadRequestError('Invalid tweet URL format');
  }

  const tweetId = tweetIdMatch[1];

  const verification = await verifyTweetWithXApi(tweetId, agent.verification_code!);
  
  if (!verification.verified) {
    throw new BadRequestError(verification.error || 'Tweet verification failed');
  }

  // Claim the agent
  const updatedAgent = await prisma.agent.update({
    where: { id: agent.id },
    data: {
      is_claimed: true,
      status: 'active',
      claimed_at: new Date(),
      owner_twitter_id: verification.twitter_id,
      owner_twitter_handle: verification.twitter_handle,
      // Clear sensitive claim data
      claim_token: null,
      verification_code: null
    }
  });

  // 🎉 Celebrate the claim on Twitter
  celebrateAgentClaim(updatedAgent.name, verification.twitter_handle!).catch(err => {
    console.error('[Claim] Failed to celebrate on Twitter:', err);
    // Don't block claim response on celebration failure
  });

  success(res, {
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
 * Verify tweet via X/Twitter API v2
 * 
 * Requires a bearer token:
 * - X_BEARER_TOKEN or TWITTER_BEARER_TOKEN
 */
async function verifyTweetWithXApi(
  tweetId: string,
  expectedCode: string
): Promise<{
  verified: boolean;
  twitter_id?: string;
  twitter_handle?: string;
  error?: string;
}> {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    return {
      verified: false,
      error: 'X/Twitter bearer token not configured'
    };
  }

  const url = `https://api.twitter.com/2/tweets/${tweetId}` +
    `?expansions=author_id&tweet.fields=text,created_at,author_id` +
    `&user.fields=username`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    return {
      verified: false,
      error: `X/Twitter API error: ${response.status} ${errorText}`
    };
  }

  const data = (await response.json()) as any;
  const tweetText = data?.data?.text as string | undefined;
  const authorId = data?.data?.author_id as string | undefined;
  const user = Array.isArray(data?.includes?.users)
    ? data.includes.users.find((u: any) => u.id === authorId)
    : undefined;
  const username = user?.username as string | undefined;

  if (!tweetText || !authorId || !username) {
    return {
      verified: false,
      error: 'Tweet data missing from X/Twitter API response'
    };
  }

  if (!tweetText.includes(expectedCode)) {
    return {
      verified: false,
      error: 'Tweet does not contain the verification code'
    };
  }

  return {
    verified: true,
    twitter_id: authorId,
    twitter_handle: `@${username}`
  };
}

export default router;

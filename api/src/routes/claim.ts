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

const router = Router();
const prisma = new PrismaClient();

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
  const { agent_name, tweet_url } = req.body;

  if (!agent_name || !tweet_url) {
    throw new BadRequestError('agent_name and tweet_url are required');
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

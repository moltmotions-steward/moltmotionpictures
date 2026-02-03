/**
 * Wallet Routes
 * /api/v1/wallet/*
 * 
 * Manages agent wallet registration and payout history.
 * Agents can register their own wallet to receive their 1% cut of tips.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { success, created } from '../utils/response.js';
import * as PayoutService from '../services/PayoutService.js';

const router = Router();

// All wallet routes require authentication
router.use(requireAuth);

/**
 * GET /wallet
 * Get the authenticated agent's wallet and earnings summary
 */
router.get('/', asyncHandler(async (req: any, res: any) => {
  const earnings = await PayoutService.getAgentEarnings(req.agent.id);
  
  if (!earnings) {
    success(res, {
      wallet_address: null,
      pending_payout_cents: 0,
      total_earned_cents: 0,
      total_paid_cents: 0,
      payout_breakdown: [],
      message: 'No wallet registered'
    });
    return;
  }
  
  success(res, {
    wallet_address: earnings.walletAddress,
    creator_wallet_address: earnings.creatorWalletAddress,
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
router.post('/', asyncHandler(async (req: any, res: any) => {
  const { wallet_address } = req.body;
  
  if (!wallet_address) {
    throw new BadRequestError('wallet_address is required');
  }
  
  // Basic validation: should look like an Ethereum address
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(wallet_address)) {
    throw new BadRequestError('Invalid wallet address format. Must be a valid Ethereum address (0x...)');
  }
  
  const agent = await PayoutService.setAgentWallet(req.agent.id, wallet_address);
  
  created(res, {
    wallet_address: agent.wallet_address,
    message: 'Wallet registered successfully'
  });
}));

/**
 * DELETE /wallet
 * Removing an agent wallet is not allowed.
 * Agents must always have a payable wallet for their 1% share.
 */
router.delete('/', asyncHandler(async (req: any, res: any) => {
  throw new BadRequestError('Agent wallet cannot be removed. Set a new wallet address instead.');
}));

/**
 * POST /wallet/creator
 * Register or update the creator (human owner) wallet address.
 * 
 * Body: { creator_wallet_address: string | null }
 * - When null/empty: clears the creator wallet (future tips will be escrowed)
 */
router.post('/creator', asyncHandler(async (req: any, res: any) => {
  const { creator_wallet_address } = req.body;

  if (creator_wallet_address && creator_wallet_address !== '') {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(creator_wallet_address)) {
      throw new BadRequestError('Invalid creator wallet address format. Must be a valid Ethereum address (0x...)');
    }
  }

  const updated = await PayoutService.setCreatorWallet(req.agent.id, creator_wallet_address || null);

  // If they just set a wallet, attempt to convert unclaimed creator funds into real payouts
  let claimResult: { createdPayouts: number; markedClaimed: number } | null = null;
  if (updated.creator_wallet_address) {
    claimResult = await PayoutService.claimUnclaimedCreatorFunds(req.agent.id, updated.creator_wallet_address);
  }

  created(res, {
    creator_wallet_address: updated.creator_wallet_address,
    claim: claimResult,
    message: updated.creator_wallet_address
      ? 'Creator wallet registered successfully'
      : 'Creator wallet cleared. Future creator shares will be escrowed.'
  });
}));

/**
 * GET /wallet/payouts
 * Get payout history for the agent
 */
router.get('/payouts', asyncHandler(async (req: any, res: any) => {
  const limit = parseInt(req.query.limit as string) || 50;
  
  // This would need to be implemented in PayoutService
  // For now, return empty array
  success(res, {
    payouts: [],
    message: 'Payout history not yet implemented'
  });
}));

export default router;

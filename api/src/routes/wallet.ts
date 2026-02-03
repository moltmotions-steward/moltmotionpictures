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
 * Remove the agent's wallet address
 * (This means the agent won't receive its 1% - it goes to... nowhere? Platform?)
 */
router.delete('/', asyncHandler(async (req: any, res: any) => {
  await PayoutService.setAgentWallet(req.agent.id, '');
  
  success(res, {
    message: 'Wallet removed. Agent will no longer receive payouts.'
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

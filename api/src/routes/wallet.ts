/**
 * Wallet Routes
 * /api/v1/wallet/*
 * 
 * Manages agent wallet registration and payout history.
 * Agents can register their own wallet to receive their 1% cut of tips.
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { success, created } from '../utils/response.js';
import * as PayoutService from '../services/PayoutService.js';
import * as WalletSignatureService from '../services/WalletSignatureService.js';

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
  throw new BadRequestError(
    'Agent wallet is immutable. Create a new agent if you need a new wallet, or contact support for an admin-only migration.'
  );
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
  const { creator_wallet_address, signature, message } = req.body || {};

  if (!signature || !message) {
    throw new BadRequestError('Missing required fields: signature, message');
  }

  const normalizedCreatorWallet =
    creator_wallet_address && creator_wallet_address !== '' ? String(creator_wallet_address).toLowerCase() : '';

  if (normalizedCreatorWallet) {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(normalizedCreatorWallet)) {
      throw new BadRequestError('Invalid creator wallet address format. Must be a valid Ethereum address (0x...)');
    }
  }

  if ((message.creatorWalletAddress ?? '') !== normalizedCreatorWallet) {
    throw new BadRequestError('Signature message does not match requested creator_wallet_address');
  }

  const sigCheck = await WalletSignatureService.verifyAgentWalletOwnership({
    agentId: req.agent.id,
    signature,
    message,
    operation: 'set_creator_wallet',
  });
  if (!sigCheck.valid) {
    throw new BadRequestError(sigCheck.error || 'Wallet signature verification failed');
  }

  const updated = await PayoutService.setCreatorWallet(req.agent.id, normalizedCreatorWallet || null);

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
 * GET /wallet/nonce
 *
 * Returns a nonce + message to sign for sensitive wallet operations.
 *
 * Query:
 * - operation: currently only "set_creator_wallet"
 * - creatorWalletAddress: the requested creator wallet (empty string means clear)
 */
router.get('/nonce', asyncHandler(async (req: any, res: any) => {
  const operation = String(req.query.operation || '');
  if (operation !== 'set_creator_wallet') {
    throw new BadRequestError('operation must be "set_creator_wallet"');
  }

  const creatorWalletAddress = typeof req.query.creatorWalletAddress === 'string' ? req.query.creatorWalletAddress : '';
  const normalizedCreatorWallet = creatorWalletAddress ? creatorWalletAddress.trim().toLowerCase() : '';

  if (normalizedCreatorWallet) {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(normalizedCreatorWallet)) {
      throw new BadRequestError('Invalid creatorWalletAddress format. Must be a valid Ethereum address (0x...)');
    }
  }

  const agent = await prisma.agent.findUnique({
    where: { id: req.agent.id },
    select: { wallet_address: true },
  });
  if (!agent) {
    throw new BadRequestError('Agent not found');
  }

  const nonceData = await WalletSignatureService.generateNonce({
    subjectType: 'agent',
    subjectId: req.agent.id,
    walletAddress: agent.wallet_address,
    operation,
  });

  const sigMessage = WalletSignatureService.createSignatureMessage({
    subjectType: 'agent',
    subjectId: req.agent.id,
    walletAddress: agent.wallet_address,
    nonce: nonceData.nonce,
    issuedAt: nonceData.issuedAt,
    expiresAt: nonceData.expiresAt,
    operation,
    creatorWalletAddress: normalizedCreatorWallet,
  });

  res.json({
    success: true,
    nonce: nonceData.nonce,
    issuedAt: nonceData.issuedAt,
    expiresAt: nonceData.expiresAt,
    message: sigMessage,
    messageToSign: WalletSignatureService.formatMessageForSigning(sigMessage),
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

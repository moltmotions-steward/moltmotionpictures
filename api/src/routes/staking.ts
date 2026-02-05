/**
 * Coinbase Prime-backed Staking Routes
 *
 * Source of truth: Coinbase Prime/Custody (custodial staking).
 * This replaces any prior DB-only "APY staking" logic.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import config from '../config/index.js';
import * as PrimeStakingService from '../services/PrimeStakingService.js';
import * as WalletSignatureService from '../services/WalletSignatureService.js';

const router = Router();

function parseBigIntString(value: unknown, fieldName: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${fieldName} must be a string integer`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${fieldName} must be a valid integer string`);
  }
}

function disabledResponse(res: Response) {
  res.status(503).json({
    success: false,
    error: 'Prime staking is disabled',
    hint: 'Set PRIME_STAKING_ENABLED=true and configure PRIME_CREDENTIALS_ENCRYPTION_KEY',
  });
}

// -----------------------------------------------------------------------------
// Nonce (wallet signature replay protection)
// -----------------------------------------------------------------------------

router.get('/nonce', requireAuth, async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress;
    const operation = req.query.operation;
    const amountWei = req.query.amountWei;
    const idempotencyKey = req.query.idempotencyKey;

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({ success: false, error: 'walletAddress query parameter is required' });
      return;
    }
    if (!operation || typeof operation !== 'string') {
      res.status(400).json({ success: false, error: 'operation query parameter is required' });
      return;
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      res.status(400).json({ success: false, error: 'idempotencyKey query parameter is required' });
      return;
    }

    const op = operation.toLowerCase();
    if (!['stake', 'unstake', 'claim'].includes(op)) {
      res.status(400).json({ success: false, error: 'operation must be one of: stake, unstake, claim' });
      return;
    }

    let amountWeiStr: string | undefined;
    if (op === 'stake' || op === 'unstake') {
      if (!amountWei || (typeof amountWei !== 'string' && typeof amountWei !== 'number')) {
        res.status(400).json({ success: false, error: 'amountWei query parameter is required for stake/unstake' });
        return;
      }
      amountWeiStr = parseBigIntString(amountWei, 'amountWei').toString();
    } else if (op === 'claim' && amountWei !== undefined) {
      if (typeof amountWei !== 'string' && typeof amountWei !== 'number') {
        res.status(400).json({ success: false, error: 'amountWei must be a string integer' });
        return;
      }
      amountWeiStr = parseBigIntString(amountWei, 'amountWei').toString();
    }

    const nonceData = await WalletSignatureService.generateNonce({
      subjectType: 'agent',
      subjectId: req.agent!.id,
      walletAddress,
      operation: op as any,
    });

    const message = WalletSignatureService.createSignatureMessage({
      subjectType: 'agent',
      subjectId: req.agent!.id,
      walletAddress,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
      expiresAt: nonceData.expiresAt,
      operation: op as any,
      asset: 'ETH',
      amountWei: amountWeiStr,
      idempotencyKey,
    });

    const messageToSign = WalletSignatureService.formatMessageForSigning(message);

    res.json({
      success: true,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
      expiresAt: nonceData.expiresAt,
      message,
      messageToSign,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to generate nonce', message: error.message });
  }
});

// -----------------------------------------------------------------------------
// Pools
// -----------------------------------------------------------------------------

router.get('/pools', async (_req: Request, res: Response) => {
  try {
    const pools = await PrimeStakingService.getPools();
    res.json({ success: true, pools });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch pools', message: error.message });
  }
});

// -----------------------------------------------------------------------------
// Stake / Unstake / Claim
// -----------------------------------------------------------------------------

router.post('/stake', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!config.coinbasePrime.enabled) return disabledResponse(res);

    // Reject legacy request shape
    if (req.body?.amountCents !== undefined) {
      res.status(400).json({
        success: false,
        error: 'Legacy staking payload rejected',
        hint: 'Use { asset:\"ETH\", amountWei:\"...\", signature, message }',
      });
      return;
    }

    const { asset, amountWei, signature, message, idempotencyKey } = req.body || {};
    if (asset !== 'ETH') {
      res.status(400).json({ success: false, error: 'asset must be \"ETH\"' });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      res.status(400).json({ success: false, error: 'Missing required field: idempotencyKey' });
      return;
    }
    if (!signature || !message) {
      res.status(400).json({ success: false, error: 'Missing required fields: signature, message' });
      return;
    }

    const parsedAmountWei = parseBigIntString(amountWei, 'amountWei');
    const amountWeiStr = parsedAmountWei.toString();

    if ((message.asset || '') !== 'ETH' || (message.amountWei || '') !== amountWeiStr || (message.idempotencyKey || '') !== idempotencyKey) {
      res.status(400).json({ success: false, error: 'Signed message does not match request (asset/amountWei/idempotencyKey)' });
      return;
    }

    const sigCheck = await WalletSignatureService.verifyAgentWalletOwnership({
      agentId: req.agent!.id,
      signature,
      message,
      operation: 'stake',
    });
    if (!sigCheck.valid) {
      res.status(401).json({ success: false, error: 'Wallet signature verification failed', message: sigCheck.error });
      return;
    }

    const op = await PrimeStakingService.stake({
      agentId: req.agent!.id,
      amountWei: parsedAmountWei,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      operation: {
        id: op.id,
        status: op.status,
        primeActivityId: op.prime_activity_id,
        primeTransactionId: op.prime_transaction_id,
        idempotencyKey: op.idempotency_key,
        amountWei: op.amount_wei?.toString(),
        createdAt: op.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to stake via Prime', message: error.message });
  }
});

router.post('/unstake', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!config.coinbasePrime.enabled) return disabledResponse(res);

    if (req.body?.amountCents !== undefined) {
      res.status(400).json({
        success: false,
        error: 'Legacy staking payload rejected',
        hint: 'Use { asset:\"ETH\", amountWei:\"...\", signature, message }',
      });
      return;
    }

    const { asset, amountWei, signature, message, idempotencyKey } = req.body || {};
    if (asset !== 'ETH') {
      res.status(400).json({ success: false, error: 'asset must be \"ETH\"' });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      res.status(400).json({ success: false, error: 'Missing required field: idempotencyKey' });
      return;
    }
    if (!signature || !message) {
      res.status(400).json({ success: false, error: 'Missing required fields: signature, message' });
      return;
    }

    const parsedAmountWei = parseBigIntString(amountWei, 'amountWei');
    const amountWeiStr = parsedAmountWei.toString();

    if ((message.asset || '') !== 'ETH' || (message.amountWei || '') !== amountWeiStr || (message.idempotencyKey || '') !== idempotencyKey) {
      res.status(400).json({ success: false, error: 'Signed message does not match request (asset/amountWei/idempotencyKey)' });
      return;
    }

    const sigCheck = await WalletSignatureService.verifyAgentWalletOwnership({
      agentId: req.agent!.id,
      signature,
      message,
      operation: 'unstake',
    });
    if (!sigCheck.valid) {
      res.status(401).json({ success: false, error: 'Wallet signature verification failed', message: sigCheck.error });
      return;
    }

    const op = await PrimeStakingService.unstake({
      agentId: req.agent!.id,
      amountWei: parsedAmountWei,
      idempotencyKey,
    });

    res.json({
      success: true,
      operation: {
        id: op.id,
        status: op.status,
        primeActivityId: op.prime_activity_id,
        primeTransactionId: op.prime_transaction_id,
        idempotencyKey: op.idempotency_key,
        amountWei: op.amount_wei?.toString(),
        createdAt: op.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to unstake via Prime', message: error.message });
  }
});

router.post('/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!config.coinbasePrime.enabled) return disabledResponse(res);

    const { asset, amountWei, signature, message, idempotencyKey } = req.body || {};
    if (asset !== 'ETH') {
      res.status(400).json({ success: false, error: 'asset must be \"ETH\"' });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      res.status(400).json({ success: false, error: 'Missing required field: idempotencyKey' });
      return;
    }
    if (!signature || !message) {
      res.status(400).json({ success: false, error: 'Missing required fields: signature, message' });
      return;
    }

    const parsedAmountWei = amountWei !== undefined ? parseBigIntString(amountWei, 'amountWei') : undefined;
    const amountWeiStr = parsedAmountWei !== undefined ? parsedAmountWei.toString() : undefined;

    if ((message.asset || '') !== 'ETH' || (message.idempotencyKey || '') !== idempotencyKey) {
      res.status(400).json({ success: false, error: 'Signed message does not match request (asset/idempotencyKey)' });
      return;
    }
    if ((amountWeiStr === undefined && message.amountWei !== undefined) || (amountWeiStr !== undefined && (message.amountWei || '') !== amountWeiStr)) {
      res.status(400).json({ success: false, error: 'Signed message does not match request (amountWei)' });
      return;
    }

    const sigCheck = await WalletSignatureService.verifyAgentWalletOwnership({
      agentId: req.agent!.id,
      signature,
      message,
      operation: 'claim',
    });
    if (!sigCheck.valid) {
      res.status(401).json({ success: false, error: 'Wallet signature verification failed', message: sigCheck.error });
      return;
    }

    const op = await PrimeStakingService.claim({
      agentId: req.agent!.id,
      amountWei: parsedAmountWei,
      idempotencyKey,
    });

    res.json({
      success: true,
      operation: {
        id: op.id,
        status: op.status,
        primeActivityId: op.prime_activity_id,
        primeTransactionId: op.prime_transaction_id,
        idempotencyKey: op.idempotency_key,
        amountWei: op.amount_wei?.toString(),
        createdAt: op.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to claim via Prime', message: error.message });
  }
});

// -----------------------------------------------------------------------------
// Status / Earnings
// -----------------------------------------------------------------------------

router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!config.coinbasePrime.enabled) return disabledResponse(res);
    const status = await PrimeStakingService.getStatus(req.agent!.id);
    res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch status', message: error.message });
  }
});

router.get('/earnings', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!config.coinbasePrime.enabled) return disabledResponse(res);
    const earnings = await PrimeStakingService.getEarnings(req.agent!.id);
    res.json({ success: true, earnings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch earnings', message: error.message });
  }
});

export default router;

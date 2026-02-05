/**
 * RefundService - Handles refunds for failed payouts
 * 
 * When a payment is successfully verified and settled via x402, but the
 * subsequent payout processing fails (e.g., insufficient funds, network error),
 * we need to refund the original payer.
 * 
 * REFUND STRATEGY:
 * 1. Failed payouts are marked with status='failed' in the payouts table
 * 2. A refund record is created in the refunds table
 * 3. RefundProcessor (cron job) processes pending refunds
 * 4. Refund is executed via USDC transfer back to payer
 * 
 * IMPORTANT: Refunds come from platform wallet, not recovered funds.
 * The platform absorbs the cost of failed payouts as a trust mechanism.
 */

import { PrismaClient } from '@prisma/client';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { prisma } from '../lib/prisma';
import config from '../config/index.js';
import * as PaymentMetrics from './PaymentMetrics.js';


// ============================================================================
// Configuration
// ============================================================================

const USDC_CONTRACTS = {
  mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  sepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
};

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

// Maximum refund processing per run
const MAX_REFUNDS_PER_RUN = 20;

// Maximum retry attempts for refunds
const MAX_REFUND_RETRIES = 3;

// ============================================================================
// Types
// ============================================================================

export interface RefundRequest {
  clipVoteId: string;
  payerAddress: string;
  amountCents: number;
  originalTxHash: string;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  txHash?: string;
  error?: string;
}

export interface RefundStats {
  processed: number;
  succeeded: number;
  failed: number;
  totalRefundedCents: number;
}

// ============================================================================
// Refund Creation
// ============================================================================

/**
 * Create a refund request when payout processing fails
 * 
 * This is called when:
 * - Payment was verified and settled
 * - Vote was recorded in database
 * - BUT payout creation/execution failed
 */
export async function createRefundRequest(request: RefundRequest): Promise<RefundResult> {
  console.log(`[RefundService] Creating refund request for vote ${request.clipVoteId}`);
  console.log(`  Payer: ${request.payerAddress}`);
  console.log(`  Amount: ${request.amountCents} cents`);
  console.log(`  Reason: ${request.reason}`);
  
  try {
    // Check for existing refund to prevent duplicates
    const existing = await prisma.refund.findFirst({
      where: {
        clip_vote_id: request.clipVoteId,
        status: { in: ['pending', 'processing'] },
      },
    });
    
    if (existing) {
      console.log(`[RefundService] Refund already exists: ${existing.id}`);
      return {
        success: true,
        refundId: existing.id,
      };
    }
    
    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        clip_vote_id: request.clipVoteId,
        payer_address: request.payerAddress,
        amount_cents: request.amountCents,
        original_tx_hash: request.originalTxHash,
        reason: request.reason,
        status: 'pending',
        retry_count: 0,
      },
    });
    
    // Update clip vote status to indicate refund pending
    await prisma.clipVote.update({
      where: { id: request.clipVoteId },
      data: { payment_status: 'refund_pending' },
    });
    
    // Track metric
    PaymentMetrics.recordRefundCreated(request.amountCents);
    
    console.log(`[RefundService] ✓ Refund created: ${refund.id}`);
    
    return {
      success: true,
      refundId: refund.id,
    };
  } catch (error) {
    console.error(`[RefundService] Failed to create refund:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Refund Processing
// ============================================================================

/**
 * Get pending refunds ready for processing
 */
async function getPendingRefunds(limit: number = MAX_REFUNDS_PER_RUN) {
  return prisma.refund.findMany({
    where: {
      status: 'pending',
      retry_count: { lt: MAX_REFUND_RETRIES },
    },
    orderBy: { created_at: 'asc' },
    take: limit,
  });
}

/**
 * Execute a refund transfer
 */
async function executeRefundTransfer(
  toAddress: string,
  amountCents: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const usdcAmount = BigInt(amountCents * 10000); // 6 decimals
  
  console.log(`[RefundService] Executing refund transfer:`);
  console.log(`  To: ${toAddress}`);
  console.log(`  Amount: ${amountCents} cents`);
  
  const platformWallet = config.x402.platformWallet;
  const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    if (config.nodeEnv !== 'production') {
      console.log(`[RefundService] SIMULATED refund (no private key)`);
      return {
        success: true,
        txHash: `0x_refund_simulated_${Date.now().toString(16)}`,
      };
    }
    return { success: false, error: 'No private key configured' };
  }
  
  try {
    const isProduction = config.nodeEnv === 'production';
    const chain = isProduction ? base : baseSepolia;
    const usdcAddress = isProduction ? USDC_CONTRACTS.mainnet : USDC_CONTRACTS.sepolia;
    const rpcUrl = isProduction ? 'https://mainnet.base.org' : 'https://sepolia.base.org';
    
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    if (platformWallet && account.address.toLowerCase() !== platformWallet.toLowerCase()) {
      return { success: false, error: 'Private key mismatch' };
    }
    
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
    
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    
    // Check balance
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    
    if (balance < usdcAmount) {
      return { success: false, error: `Insufficient balance: ${balance} < ${usdcAmount}` };
    }
    
    // Execute transfer
    const hash = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress as Address, usdcAmount],
    });
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });
    
    if (receipt.status === 'success') {
      return { success: true, txHash: hash };
    } else {
      return { success: false, error: `Transaction reverted: ${hash}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single refund
 */
async function processSingleRefund(refund: any): Promise<boolean> {
  console.log(`[RefundService] Processing refund ${refund.id}`);
  
  // Mark as processing
  await prisma.refund.update({
    where: { id: refund.id },
    data: { status: 'processing' },
  });
  
  try {
    const result = await executeRefundTransfer(
      refund.payer_address,
      refund.amount_cents
    );
    
    if (result.success) {
      // Mark refund as completed
      await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'completed',
          tx_hash: result.txHash,
          processed_at: new Date(),
        },
      });
      
      // Update clip vote status
      await prisma.clipVote.update({
        where: { id: refund.clip_vote_id },
        data: { payment_status: 'refunded' },
      });
      
      // Track metric
      PaymentMetrics.recordRefundCompleted(refund.amount_cents);
      
      console.log(`[RefundService] ✓ Refund completed: ${result.txHash}`);
      return true;
    } else {
      // Increment retry counter
      const newRetryCount = refund.retry_count + 1;
      const newStatus = newRetryCount >= MAX_REFUND_RETRIES ? 'failed' : 'pending';
      
      await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: newStatus,
          retry_count: newRetryCount,
          error_message: result.error,
        },
      });
      
      if (newStatus === 'failed') {
        PaymentMetrics.recordRefundFailed(refund.amount_cents);
        console.error(`[RefundService] ✗ Refund permanently failed: ${result.error}`);
      } else {
        console.log(`[RefundService] Refund will retry (attempt ${newRetryCount}/${MAX_REFUND_RETRIES})`);
      }
      
      return false;
    }
  } catch (error) {
    // Reset to pending for retry
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'pending',
        retry_count: { increment: 1 },
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    return false;
  }
}

/**
 * Process all pending refunds (called by cron job)
 */
export async function processRefunds(): Promise<RefundStats> {
  console.log('[RefundService] Starting refund processing run...');
  
  const stats: RefundStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    totalRefundedCents: 0,
  };
  
  const refunds = await getPendingRefunds();
  console.log(`[RefundService] Found ${refunds.length} pending refunds`);
  
  for (const refund of refunds) {
    stats.processed++;
    const success = await processSingleRefund(refund);
    if (success) {
      stats.succeeded++;
      stats.totalRefundedCents += refund.amount_cents;
    } else {
      stats.failed++;
    }
  }
  
  console.log(`[RefundService] Run complete:`, stats);
  return stats;
}

/**
 * Get refund status for a clip vote
 */
export async function getRefundStatus(clipVoteId: string) {
  const refund = await prisma.refund.findFirst({
    where: { clip_vote_id: clipVoteId },
    orderBy: { created_at: 'desc' },
  });
  
  if (!refund) {
    return { hasRefund: false };
  }
  
  return {
    hasRefund: true,
    status: refund.status,
    amountCents: refund.amount_cents,
    txHash: refund.tx_hash,
    createdAt: refund.created_at,
    processedAt: refund.processed_at,
  };
}

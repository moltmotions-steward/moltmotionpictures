/**
 * PayoutProcessor - Processes pending payouts by executing USDC transfers
 * 
 * This service is designed to run as a cron job to:
 * 1. Fetch pending payouts from the database
 * 2. Execute USDC transfers via Coinbase AgentKit or direct contract calls
 * 3. Update payout status to completed or failed
 * 4. Handle retries with exponential backoff
 * 
 * SECURITY CONSIDERATIONS:
 * - This service holds the platform wallet private key
 * - It must be idempotent (never double-pay)
 * - It must handle failures gracefully
 * - All transfers must be logged for audit
 * 
 * Run via cron: every 5 minutes
 * K8s CronJob manifest: k8s/25-payout-processor-cronjob.yaml
 */

import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface TransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface ProcessingStats {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface PayoutBatch {
  id: string;
  wallet_address: string;
  amount_cents: number;
  recipient_type: string;
  source_agent_id: string | null;
  retry_count: number;
  created_at: Date;
}

// ============================================================================
// Configuration
// ============================================================================

// Maximum payouts to process per run to avoid timeout
const MAX_PAYOUTS_PER_RUN = 50;

// Maximum retry attempts before giving up
const MAX_RETRY_ATTEMPTS = 5;

// Minimum amount in cents to process (avoid dust)
const MIN_PAYOUT_CENTS = 1;

// Base delay for exponential backoff (milliseconds)
const RETRY_BASE_DELAY_MS = 1000;

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// ============================================================================
// Transfer Implementation
// ============================================================================

/**
 * Execute a USDC transfer to a wallet address
 * 
 * In production, this would use:
 * - Coinbase AgentKit for managed wallets
 * - viem/ethers for direct contract calls
 * - A queue system for high-volume transfers
 * 
 * For now, this is a placeholder that logs the transfer
 * and returns success. Replace with actual implementation.
 */
async function executeUsdcTransfer(
  toAddress: string,
  amountCents: number
): Promise<TransferResult> {
  // Convert cents to USDC (6 decimals)
  // 1 cent = 0.01 USDC = 10000 micro-USDC
  const usdcAmount = BigInt(amountCents * 10000);
  
  console.log(`[PayoutProcessor] Executing transfer:`);
  console.log(`  To: ${toAddress}`);
  console.log(`  Amount: ${amountCents} cents (${usdcAmount} micro-USDC)`);
  
  // Check if we have a platform wallet configured
  const platformWallet = config.x402.platformWallet;
  if (!platformWallet) {
    return {
      success: false,
      error: 'Platform wallet not configured',
    };
  }
  
  // TODO: Implement actual USDC transfer
  // Options:
  // 1. Coinbase AgentKit - https://docs.cdp.coinbase.com/agentkit/
  // 2. viem with ERC20 ABI - https://viem.sh/docs/contract/writeContract.html
  // 3. ethers.js Contract - https://docs.ethers.org/v6/
  
  // For now, simulate the transfer
  // In production, replace this with actual blockchain call
  const isProduction = config.nodeEnv === 'production';
  
  if (!isProduction) {
    // In development/test, simulate success
    console.log(`[PayoutProcessor] SIMULATED transfer (not production)`);
    return {
      success: true,
      txHash: `0x_simulated_${Date.now().toString(16)}`,
    };
  }
  
  // Production transfer would go here
  // Example with Coinbase AgentKit:
  /*
  try {
    const { CdpClient } = await import('@coinbase/cdp-sdk');
    const cdp = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_NAME,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
    });
    
    const wallet = await cdp.wallets.get(process.env.PLATFORM_WALLET_ID);
    const tx = await wallet.transfer({
      to: toAddress,
      amount: usdcAmount.toString(),
      token: 'USDC',
      network: 'base',
    });
    
    return {
      success: true,
      txHash: tx.transactionHash,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transfer failed',
    };
  }
  */
  
  // For now, return not implemented in production
  return {
    success: false,
    error: 'Production transfer not implemented - configure CDP_API_KEY',
  };
}

// ============================================================================
// Payout Processing
// ============================================================================

/**
 * Get payouts ready for processing
 * Filters to pending payouts that:
 * - Have a valid wallet address
 * - Are above minimum amount
 * - Haven't exceeded retry limit
 */
async function getProcessablePayouts(limit: number = MAX_PAYOUTS_PER_RUN): Promise<PayoutBatch[]> {
  const payouts = await prisma.payout.findMany({
    where: {
      status: 'pending',
      wallet_address: { not: '' },
      amount_cents: { gte: MIN_PAYOUT_CENTS },
      retry_count: { lt: MAX_RETRY_ATTEMPTS },
    },
    orderBy: [
      { created_at: 'asc' }, // Process oldest first
    ],
    take: limit,
  });
  
  return payouts as unknown as PayoutBatch[];
}

/**
 * Process a single payout
 * 
 * Marks as 'processing' before transfer attempt to prevent
 * duplicate processing if another job starts
 */
async function processSinglePayout(payout: PayoutBatch): Promise<TransferResult> {
  console.log(`[PayoutProcessor] Processing payout ${payout.id}`);
  console.log(`  Type: ${payout.recipient_type}`);
  console.log(`  Amount: ${payout.amount_cents} cents`);
  console.log(`  To: ${payout.wallet_address}`);
  
  // Mark as processing (optimistic lock)
  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: 'processing' },
  });
  
  try {
    // Execute the transfer
    const result = await executeUsdcTransfer(
      payout.wallet_address,
      payout.amount_cents
    );
    
    if (result.success) {
      // Mark as completed
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'completed',
          tx_hash: result.txHash,
          completed_at: new Date(),
        },
      });
      
      // Update agent's paid amount if this is an agent payout
      if (payout.source_agent_id) {
        await prisma.agent.update({
          where: { id: payout.source_agent_id },
          data: {
            pending_payout_cents: { decrement: payout.amount_cents },
            total_paid_cents: { increment: payout.amount_cents },
          },
        });
      }
      
      console.log(`[PayoutProcessor] ✓ Payout ${payout.id} completed: ${result.txHash}`);
    } else {
      // Mark as failed with retry increment
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'failed',
          error_message: result.error,
          retry_count: { increment: 1 },
        },
      });
      
      console.log(`[PayoutProcessor] ✗ Payout ${payout.id} failed: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    // Unexpected error - mark as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'failed',
        error_message: errorMessage,
        retry_count: { increment: 1 },
      },
    });
    
    console.error(`[PayoutProcessor] ✗ Payout ${payout.id} error:`, error);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Retry failed payouts that haven't exceeded the retry limit
 * Uses exponential backoff based on retry_count
 */
async function retryFailedPayouts(): Promise<number> {
  const failedPayouts = await prisma.payout.findMany({
    where: {
      status: 'failed',
      retry_count: { lt: MAX_RETRY_ATTEMPTS },
    },
    orderBy: { created_at: 'asc' },
    take: 10, // Process fewer retries per run
  });
  
  let retriedCount = 0;
  
  for (const payout of failedPayouts) {
    // Calculate backoff delay
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, payout.retry_count || 0);
    
    // Check if enough time has passed since last attempt
    const lastAttempt = payout.updated_at || payout.created_at;
    const timeSinceLastAttempt = Date.now() - new Date(lastAttempt).getTime();
    
    if (timeSinceLastAttempt < delay) {
      console.log(`[PayoutProcessor] Skipping retry ${payout.id} - backoff not elapsed`);
      continue;
    }
    
    // Reset to pending for reprocessing
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'pending' },
    });
    
    retriedCount++;
  }
  
  return retriedCount;
}

// ============================================================================
// Main Entry Points
// ============================================================================

/**
 * Main processing function - call this from cron job
 * 
 * Returns stats about the processing run
 */
export async function processPayouts(): Promise<ProcessingStats> {
  console.log('[PayoutProcessor] Starting payout processing run...');
  
  const stats: ProcessingStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  
  try {
    // First, retry any failed payouts that are ready
    const retriedCount = await retryFailedPayouts();
    console.log(`[PayoutProcessor] Queued ${retriedCount} failed payouts for retry`);
    
    // Get pending payouts
    const payouts = await getProcessablePayouts();
    console.log(`[PayoutProcessor] Found ${payouts.length} payouts to process`);
    
    if (payouts.length === 0) {
      console.log('[PayoutProcessor] No payouts to process');
      return stats;
    }
    
    // Process each payout
    for (const payout of payouts) {
      stats.processed++;
      
      // Validate wallet address format
      if (!payout.wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(payout.wallet_address)) {
        console.log(`[PayoutProcessor] Skipping ${payout.id} - invalid wallet address`);
        stats.skipped++;
        continue;
      }
      
      const result = await processSinglePayout(payout);
      
      if (result.success) {
        stats.succeeded++;
      } else {
        stats.failed++;
        stats.errors.push(`${payout.id}: ${result.error}`);
      }
      
      // Small delay between transfers to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } catch (error) {
    console.error('[PayoutProcessor] Fatal error:', error);
    stats.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  console.log('[PayoutProcessor] Run complete:', stats);
  return stats;
}

/**
 * Get processing statistics for monitoring
 */
export async function getPayoutStats() {
  const stats = await prisma.payout.groupBy({
    by: ['status', 'recipient_type'],
    _sum: { amount_cents: true },
    _count: true,
  });
  
  const pending = await prisma.payout.count({
    where: { status: 'pending' },
  });
  
  const processing = await prisma.payout.count({
    where: { status: 'processing' },
  });
  
  const failed = await prisma.payout.count({
    where: { status: 'failed' },
  });
  
  const completed = await prisma.payout.count({
    where: { status: 'completed' },
  });
  
  return {
    counts: { pending, processing, failed, completed },
    breakdown: stats.map(s => ({
      status: s.status,
      recipientType: s.recipient_type,
      totalCents: s._sum.amount_cents || 0,
      count: s._count,
    })),
  };
}

/**
 * Reset stuck payouts (processing for too long)
 * Call this periodically to handle crashed jobs
 */
export async function resetStuckPayouts(stuckThresholdMinutes: number = 30): Promise<number> {
  const stuckThreshold = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000);
  
  const result = await prisma.payout.updateMany({
    where: {
      status: 'processing',
      updated_at: { lt: stuckThreshold },
    },
    data: {
      status: 'pending',
    },
  });
  
  if (result.count > 0) {
    console.log(`[PayoutProcessor] Reset ${result.count} stuck payouts`);
  }
  
  return result.count;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Run the processor from command line
 * Usage: npx ts-node src/services/PayoutProcessor.ts
 */
async function main() {
  console.log('='.repeat(60));
  console.log('[PayoutProcessor] Manual run started');
  console.log('='.repeat(60));
  
  // Reset any stuck payouts first
  await resetStuckPayouts();
  
  // Process payouts
  const stats = await processPayouts();
  
  console.log('='.repeat(60));
  console.log('[PayoutProcessor] Results:');
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Succeeded: ${stats.succeeded}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  if (stats.errors.length > 0) {
    console.log('  Errors:');
    stats.errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
}

// Only run main if this is the entry point
if (require.main === module) {
  main().catch(console.error);
}

export default {
  processPayouts,
  getPayoutStats,
  resetStuckPayouts,
};

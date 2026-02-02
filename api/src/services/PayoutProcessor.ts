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
import { 
  createWalletClient, 
  createPublicClient,
  http, 
  parseAbi,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import config from '../config/index.js';
import * as PaymentMetrics from './PaymentMetrics.js';
import * as RefundService from './RefundService.js';

const prisma = new PrismaClient();

// ============================================================================
// Blockchain Configuration
// ============================================================================

// USDC contract addresses
const USDC_CONTRACTS = {
  mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  sepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
};

// ERC20 transfer ABI (minimal)
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

// Get chain config based on environment
function getChainConfig() {
  const isProduction = config.nodeEnv === 'production';
  return {
    chain: isProduction ? base : baseSepolia,
    usdcAddress: isProduction ? USDC_CONTRACTS.mainnet : USDC_CONTRACTS.sepolia,
    rpcUrl: isProduction 
      ? 'https://mainnet.base.org'
      : 'https://sepolia.base.org',
  };
}

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
 * Execute a USDC transfer to a wallet address using viem
 * 
 * This function:
 * 1. Creates a wallet client from the platform wallet private key
 * 2. Calls the USDC ERC20 transfer() function
 * 3. Waits for transaction confirmation
 * 4. Returns the transaction hash
 * 
 * SECURITY: The private key should be stored in a secure vault
 * and loaded only when needed. Never log the private key.
 */
async function executeUsdcTransfer(
  toAddress: string,
  amountCents: number
): Promise<TransferResult> {
  // Convert cents to USDC (6 decimals)
  // 1 cent = 0.01 USDC = 10000 micro-USDC
  const usdcAmount = BigInt(amountCents * 10000);
  
  console.log(`[PayoutProcessor] Executing USDC transfer:`);
  console.log(`  To: ${toAddress}`);
  console.log(`  Amount: ${amountCents} cents (${usdcAmount} micro-USDC)`);
  
  // Check configuration
  const platformWallet = config.x402.platformWallet;
  if (!platformWallet) {
    return {
      success: false,
      error: 'Platform wallet address not configured',
    };
  }

  // Get private key from environment (stored securely)
  const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    // In non-production, simulate if no private key
    if (config.nodeEnv !== 'production') {
      console.log(`[PayoutProcessor] SIMULATED transfer (no private key)`);
      return {
        success: true,
        txHash: `0x_simulated_${Date.now().toString(16)}`,
      };
    }
    return {
      success: false,
      error: 'Platform wallet private key not configured',
    };
  }

  try {
    const chainConfig = getChainConfig();
    
    // Create wallet client from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Verify the account matches expected platform wallet
    if (account.address.toLowerCase() !== platformWallet.toLowerCase()) {
      return {
        success: false,
        error: `Private key mismatch: expected ${platformWallet}, got ${account.address}`,
      };
    }
    
    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });
    
    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });
    
    // Check USDC balance before transfer
    const balance = await publicClient.readContract({
      address: chainConfig.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    
    if (balance < usdcAmount) {
      return {
        success: false,
        error: `Insufficient USDC balance: have ${balance}, need ${usdcAmount}`,
      };
    }
    
    console.log(`[PayoutProcessor] Submitting transaction to ${chainConfig.chain.name}...`);
    
    // Execute the transfer
    const hash = await walletClient.writeContract({
      address: chainConfig.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress as Address, usdcAmount],
    });
    
    console.log(`[PayoutProcessor] Transaction submitted: ${hash}`);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      confirmations: 1,
    });
    
    if (receipt.status === 'success') {
      console.log(`[PayoutProcessor] ✓ Transfer confirmed in block ${receipt.blockNumber}`);
      return {
        success: true,
        txHash: hash,
      };
    } else {
      return {
        success: false,
        error: `Transaction reverted: ${hash}`,
      };
    }
    
  } catch (error) {
    console.error(`[PayoutProcessor] Transfer error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transfer error',
    };
  }
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
      
      // Track metric
      PaymentMetrics.recordPayoutCompleted(payout.amount_cents);
    } else {
      // Mark as failed with retry increment
      const newRetryCount = (payout.retry_count || 0) + 1;
      const permanentlyFailed = newRetryCount >= MAX_RETRY_ATTEMPTS;
      
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: permanentlyFailed ? 'permanently_failed' : 'failed',
          error_message: result.error,
          retry_count: newRetryCount,
        },
      });
      
      console.log(`[PayoutProcessor] ✗ Payout ${payout.id} failed: ${result.error}`);
      
      // Track metric
      PaymentMetrics.recordPayoutFailed(payout.amount_cents, result.error || 'Unknown error');
      
      // If permanently failed and has a clip vote, trigger refund
      if (permanentlyFailed) {
        // Get the payout with clip_vote_id
        const fullPayout = await prisma.payout.findUnique({
          where: { id: payout.id },
        });
        
        if (fullPayout?.clip_vote_id) {
          // Fetch the clip vote separately
          const vote = await prisma.clipVote.findUnique({
            where: { id: fullPayout.clip_vote_id },
          });
          
          // Only refund if this is a creator payout (the main payout)
          if (payout.recipient_type === 'creator' && vote?.payment_tx_hash) {
            await RefundService.createRefundRequest({
              clipVoteId: vote.id,
              payerAddress: vote.payment_tx_hash.startsWith('0x') 
                ? vote.payment_tx_hash 
                : '0x0000000000000000000000000000000000000000',
              amountCents: vote.tip_amount_cents,
              originalTxHash: vote.payment_tx_hash,
              reason: `Payout failed after ${MAX_RETRY_ATTEMPTS} attempts: ${result.error}`,
            });
          }
        }
      }
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

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
/**
 * Main processing function - call this from cron job
 *
 * Returns stats about the processing run
 */
export declare function processPayouts(): Promise<ProcessingStats>;
/**
 * Get processing statistics for monitoring
 */
export declare function getPayoutStats(): Promise<{
    counts: {
        pending: any;
        processing: any;
        failed: any;
        completed: any;
    };
    breakdown: any;
}>;
/**
 * Reset stuck payouts (processing for too long)
 * Call this periodically to handle crashed jobs
 */
export declare function resetStuckPayouts(stuckThresholdMinutes?: number): Promise<number>;
declare const _default: {
    processPayouts: typeof processPayouts;
    getPayoutStats: typeof getPayoutStats;
    resetStuckPayouts: typeof resetStuckPayouts;
};
export default _default;
//# sourceMappingURL=PayoutProcessor.d.ts.map
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
/**
 * Create a refund request when payout processing fails
 *
 * This is called when:
 * - Payment was verified and settled
 * - Vote was recorded in database
 * - BUT payout creation/execution failed
 */
export declare function createRefundRequest(request: RefundRequest): Promise<RefundResult>;
/**
 * Process all pending refunds (called by cron job)
 */
export declare function processRefunds(): Promise<RefundStats>;
/**
 * Get refund status for a clip vote
 */
export declare function getRefundStatus(clipVoteId: string): Promise<{
    hasRefund: boolean;
    status?: undefined;
    amountCents?: undefined;
    txHash?: undefined;
    createdAt?: undefined;
    processedAt?: undefined;
} | {
    hasRefund: boolean;
    status: any;
    amountCents: any;
    txHash: any;
    createdAt: any;
    processedAt: any;
}>;
//# sourceMappingURL=RefundService.d.ts.map
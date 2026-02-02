export type RecipientType = 'creator' | 'agent' | 'platform';
export interface PayoutSplit {
    recipientType: RecipientType;
    walletAddress: string;
    amountCents: number;
    splitPercent: number;
}
export interface TipProcessingResult {
    success: boolean;
    clipVoteId: string;
    totalTipCents: number;
    splits: PayoutSplit[];
    payoutIds: string[];
    error?: string;
}
/**
 * Calculate the revenue splits for a tip
 * @param totalCents - Total tip amount in cents
 * @returns Array of splits with amounts
 */
export declare function calculateSplits(totalCents: number): {
    creator: number;
    platform: number;
    agent: number;
};
/**
 * Process a tip and create payout records for all parties
 *
 * @param clipVoteId - The ClipVote record with the tip
 * @param tipAmountCents - Total tip amount
 * @param sourceAgentId - The agent that authored the winning content
 * @param creatorWalletAddress - Creator's wallet (user who owns the agent)
 * @param agentWalletAddress - Agent's own wallet (if set)
 * @returns Processing result with payout IDs
 */
export declare function processTipPayouts(clipVoteId: string, tipAmountCents: number, sourceAgentId: string, creatorWalletAddress: string | null, agentWalletAddress: string | null): Promise<TipProcessingResult>;
/**
 * Get pending payouts for processing
 * @param limit - Maximum number of payouts to retrieve
 */
export declare function getPendingPayouts(limit?: number): Promise<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    wallet_address: string;
    recipient_type: string;
    source_agent_id: string;
    recipient_agent_id: string | null;
    clip_vote_id: string | null;
    amount_cents: number;
    split_percent: number;
    tx_hash: string | null;
    error_message: string | null;
    retry_count: number;
    completed_at: Date | null;
}[]>;
/**
 * Mark a payout as completed after successful transfer
 */
export declare function completePayout(payoutId: string, txHash: string): Promise<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    wallet_address: string;
    recipient_type: string;
    source_agent_id: string;
    recipient_agent_id: string | null;
    clip_vote_id: string | null;
    amount_cents: number;
    split_percent: number;
    tx_hash: string | null;
    error_message: string | null;
    retry_count: number;
    completed_at: Date | null;
}>;
/**
 * Mark a payout as failed
 */
export declare function failPayout(payoutId: string, errorMessage: string): Promise<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    wallet_address: string;
    recipient_type: string;
    source_agent_id: string;
    recipient_agent_id: string | null;
    clip_vote_id: string | null;
    amount_cents: number;
    split_percent: number;
    tx_hash: string | null;
    error_message: string | null;
    retry_count: number;
    completed_at: Date | null;
}>;
/**
 * Get earnings summary for an agent
 */
export declare function getAgentEarnings(agentId: string): Promise<{
    walletAddress: string | null;
    pendingPayoutCents: number;
    totalEarnedCents: number;
    totalPaidCents: number;
    payoutBreakdown: {
        recipientType: string;
        status: string;
        totalCents: number;
        count: number;
    }[];
} | null>;
/**
 * Register or update an agent's wallet address
 */
export declare function setAgentWallet(agentId: string, walletAddress: string): Promise<{
    name: string;
    id: string;
    display_name: string | null;
    description: string | null;
    avatar_url: string | null;
    api_key_hash: string;
    claim_token: string | null;
    verification_code: string | null;
    status: string;
    is_claimed: boolean;
    is_active: boolean;
    karma: number;
    follower_count: number;
    following_count: number;
    owner_twitter_id: string | null;
    owner_twitter_handle: string | null;
    created_at: Date;
    updated_at: Date;
    claimed_at: Date | null;
    last_active: Date;
    wallet_address: string | null;
    pending_payout_cents: bigint;
    total_earned_cents: bigint;
    total_paid_cents: bigint;
}>;
declare const _default: {
    calculateSplits: typeof calculateSplits;
    processTipPayouts: typeof processTipPayouts;
    getPendingPayouts: typeof getPendingPayouts;
    completePayout: typeof completePayout;
    failPayout: typeof failPayout;
    getAgentEarnings: typeof getAgentEarnings;
    setAgentWallet: typeof setAgentWallet;
};
export default _default;
//# sourceMappingURL=PayoutService.d.ts.map
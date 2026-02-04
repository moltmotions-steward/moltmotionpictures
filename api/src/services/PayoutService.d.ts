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
export declare function getPendingPayouts(limit?: number): Promise<any>;
/**
 * Mark a payout as completed after successful transfer
 */
export declare function completePayout(payoutId: string, txHash: string): Promise<any>;
/**
 * Mark a payout as failed
 */
export declare function failPayout(payoutId: string, errorMessage: string): Promise<any>;
/**
 * Get earnings summary for an agent
 */
export declare function getAgentEarnings(agentId: string): Promise<{
    walletAddress: any;
    creatorWalletAddress: any;
    pendingPayoutCents: number;
    totalEarnedCents: number;
    totalPaidCents: number;
    payoutBreakdown: any;
} | null>;
/**
 * Register or update an agent's wallet address
 */
export declare function setAgentWallet(agentId: string, walletAddress: string): Promise<any>;
/**
 * Register or update the creator (human owner) wallet address for an agent.
 */
export declare function setCreatorWallet(agentId: string, creatorWalletAddress: string | null): Promise<any>;
/**
 * Convert valid, unexpired unclaimed creator funds into real payout entries.
 */
export declare function claimUnclaimedCreatorFunds(agentId: string, creatorWalletAddress: string): Promise<any>;
declare const _default: {
    calculateSplits: typeof calculateSplits;
    processTipPayouts: typeof processTipPayouts;
    getPendingPayouts: typeof getPendingPayouts;
    completePayout: typeof completePayout;
    failPayout: typeof failPayout;
    getAgentEarnings: typeof getAgentEarnings;
    setAgentWallet: typeof setAgentWallet;
    setCreatorWallet: typeof setCreatorWallet;
    claimUnclaimedCreatorFunds: typeof claimUnclaimedCreatorFunds;
};
export default _default;
//# sourceMappingURL=PayoutService.d.ts.map
/**
 * Staking Service
 *
 * Manages staking pools, stakes, and reward distribution for agents.
 *
 * Features:
 * - Create and manage staking pools
 * - Stake/unstake operations with wallet verification
 * - MEV protection via minimum stake duration
 * - Automatic reward calculation and distribution
 * - Multi-wallet support
 *
 * Security considerations:
 * - Minimum stake duration prevents MEV pool sniping
 * - Wallet signature verification for all operations
 * - Rate limiting on stake/unstake operations
 * - Idempotent operations
 */
export interface StakeParams {
    agentId: string;
    poolId: string;
    amountCents: bigint;
    walletAddress: string;
    walletSignature?: string;
}
export interface UnstakeParams {
    stakeId: string;
    agentId: string;
    walletSignature?: string;
}
export interface StakingStatus {
    totalStakedCents: bigint;
    activeStakes: number;
    totalEarnedCents: bigint;
    claimedRewardsCents: bigint;
    pendingRewardsCents: bigint;
    stakes: Array<{
        id: string;
        poolName: string;
        amountCents: bigint;
        status: string;
        earnedRewardsCents: bigint;
        claimedRewardsCents: bigint;
        stakedAt: Date;
        canUnstakeAt: Date;
    }>;
}
export interface StakingEarnings {
    totalEarnedCents: bigint;
    claimedRewardsCents: bigint;
    pendingRewardsCents: bigint;
    rewardHistory: Array<{
        id: string;
        amountCents: bigint;
        periodStart: Date;
        periodEnd: Date;
        isClaimed: boolean;
        claimedAt: Date | null;
    }>;
}
/**
 * Get or create the default staking pool
 */
export declare function getOrCreateDefaultPool(): Promise<{
    name: string;
    id: string;
    description: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    min_stake_amount_cents: bigint;
    min_stake_duration_seconds: number;
    apy_basis_points: number;
    max_total_stake_cents: bigint | null;
    is_default: boolean;
    total_staked_cents: bigint;
    total_stakes_count: number;
    total_rewards_paid_cents: bigint;
}>;
/**
 * Get all active staking pools
 */
export declare function getActivePools(): Promise<{
    name: string;
    id: string;
    description: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    min_stake_amount_cents: bigint;
    min_stake_duration_seconds: number;
    apy_basis_points: number;
    max_total_stake_cents: bigint | null;
    is_default: boolean;
    total_staked_cents: bigint;
    total_stakes_count: number;
    total_rewards_paid_cents: bigint;
}[]>;
/**
 * Get staking pool by ID
 */
export declare function getPoolById(poolId: string): Promise<{
    name: string;
    id: string;
    description: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    min_stake_amount_cents: bigint;
    min_stake_duration_seconds: number;
    apy_basis_points: number;
    max_total_stake_cents: bigint | null;
    is_default: boolean;
    total_staked_cents: bigint;
    total_stakes_count: number;
    total_rewards_paid_cents: bigint;
} | null>;
/**
 * Stake tokens in a pool
 *
 * @param params - Stake parameters
 * @returns Created stake record
 */
export declare function stake(params: StakeParams): Promise<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    wallet_address: string;
    agent_id: string;
    amount_cents: bigint;
    earned_rewards_cents: bigint;
    claimed_rewards_cents: bigint;
    last_reward_calc_at: Date;
    stake_tx_hash: string | null;
    unstake_tx_hash: string | null;
    can_unstake_at: Date;
    staked_at: Date;
    unstaked_at: Date | null;
    pool_id: string;
}>;
/**
 * Unstake tokens from a pool
 *
 * @param params - Unstake parameters
 * @returns Updated stake record
 */
export declare function unstake(params: UnstakeParams): Promise<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    wallet_address: string;
    agent_id: string;
    amount_cents: bigint;
    earned_rewards_cents: bigint;
    claimed_rewards_cents: bigint;
    last_reward_calc_at: Date;
    stake_tx_hash: string | null;
    unstake_tx_hash: string | null;
    can_unstake_at: Date;
    staked_at: Date;
    unstaked_at: Date | null;
    pool_id: string;
}>;
/**
 * Calculate rewards for a stake based on APY and time staked
 *
 * Formula: reward = (stake_amount * apy_basis_points * seconds_staked) / (10000 * 365 * 24 * 3600)
 */
export declare function calculateRewards(stakeId: string): Promise<void>;
/**
 * Calculate rewards for all active stakes (background job)
 */
export declare function calculateAllRewards(): Promise<number>;
/**
 * Claim pending rewards for a stake
 */
export declare function claimRewards(stakeId: string, agentId: string): Promise<number>;
/**
 * Get staking status for an agent
 */
export declare function getStakingStatus(agentId: string): Promise<StakingStatus>;
/**
 * Get staking earnings details for an agent
 */
export declare function getStakingEarnings(agentId: string): Promise<StakingEarnings>;
//# sourceMappingURL=StakingService.d.ts.map
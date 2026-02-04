/**
 * Staking Service
 *
 * Manages staking pools, stakes, and reward distribution for agents.
 *
 * Features:
 * - Create and manage staking pools
 * - Stake/unstake operations with wallet verification
 * - Time-lock protection via minimum stake duration
 * - Automatic reward calculation and distribution
 * - Multi-wallet support
 *
 * Security considerations:
 * - Minimum stake duration prevents rapid cycling abuse
 * - Wallet signature verification for all value-changing operations (REQUIRED)
 * - Rate limiting on stake/unstake operations
 * - Idempotent operations
 */
import * as WalletSignatureService from './WalletSignatureService.js';
export interface StakeParams {
    agentId: string;
    poolId: string;
    amountCents: bigint;
    walletAddress: string;
    signature: string;
    message: WalletSignatureService.SignatureMessage;
}
export interface UnstakeParams {
    stakeId: string;
    agentId: string;
    signature: string;
    message: WalletSignatureService.SignatureMessage;
}
export interface ClaimParams {
    stakeId: string;
    agentId: string;
    signature: string;
    message: WalletSignatureService.SignatureMessage;
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
export declare function getOrCreateDefaultPool(): Promise<any>;
/**
 * Get all active staking pools
 */
export declare function getActivePools(): Promise<any>;
/**
 * Get staking pool by ID
 */
export declare function getPoolById(poolId: string): Promise<any>;
/**
 * Stake tokens in a pool
 *
 * @param params - Stake parameters
 * @returns Created stake record
 */
export declare function stake(params: StakeParams): Promise<any>;
/**
 * Unstake tokens from a pool
 *
 * @param params - Unstake parameters
 * @returns Updated stake record
 */
export declare function unstake(params: UnstakeParams): Promise<any>;
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
export declare function claimRewards(params: ClaimParams): Promise<bigint>;
/**
 * Get staking status for an agent
 */
export declare function getStakingStatus(agentId: string): Promise<StakingStatus>;
/**
 * Get staking earnings details for an agent
 */
export declare function getStakingEarnings(agentId: string): Promise<StakingEarnings>;
//# sourceMappingURL=StakingService.d.ts.map
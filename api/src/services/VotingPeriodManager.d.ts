/**
 * VotingPeriodManager.ts
 *
 * Background job management for voting periods.
 * Handles:
 * - Opening new voting periods on schedule
 * - Closing expired periods and tallying votes
 * - Selecting winners and triggering production pipeline
 *
 * Design:
 * - Uses node-cron for scheduling
 * - Processes one category at a time to avoid race conditions
 * - Logs all actions for audit trail
 * - Integrates with production pipeline for series creation
 */
import { VotingPeriod } from '@prisma/client';
export interface VotingPeriodConfig {
    /** Duration of agent voting period in hours */
    agentVotingDurationHours: number;
    /** Duration of human clip voting period in hours */
    humanVotingDurationHours: number;
    /** Day of week to start new periods (0=Sunday, 1=Monday, etc.) */
    startDayOfWeek: number;
    /** Hour of day to start new periods (0-23) */
    startHour: number;
    /** Minimum scripts required to start voting */
    minScriptsForVoting: number;
}
export interface VotingPeriodResult {
    periodId: string;
    winnerId: string | null;
    totalScripts: number;
    totalVotes: number;
    processedAt: Date;
}
export interface ProductionRequest {
    scriptId: string;
    seriesTitle: string;
    studioId: string;
    agentId: string;
    categoryId: string;
    priority: 'normal' | 'high';
}
/**
 * Creates the next voting period based on configuration.
 */
export declare function createNextVotingPeriod(periodType: 'agent_voting' | 'human_voting', config?: VotingPeriodConfig): Promise<VotingPeriod>;
/**
 * Opens a voting period (activates it and moves scripts into voting).
 */
export declare function openVotingPeriod(periodId: string, config?: VotingPeriodConfig): Promise<{
    period: VotingPeriod;
    scriptsCount: number;
}>;
/**
 * Closes a voting period, tallies votes, and selects winner.
 */
export declare function closeVotingPeriod(periodId: string): Promise<VotingPeriodResult>;
/**
 * Checks for periods that need to be opened (start time has passed).
 */
export declare function checkAndOpenPeriods(): Promise<void>;
/**
 * Checks for periods that need to be closed (end time has passed).
 */
export declare function checkAndClosePeriods(): Promise<VotingPeriodResult[]>;
/**
 * Creates upcoming periods if none exist.
 */
export declare function ensureUpcomingPeriods(config?: VotingPeriodConfig): Promise<void>;
/**
 * Main cron tick - runs all periodic checks.
 */
export declare function runCronTick(): Promise<{
    opened: number;
    closed: VotingPeriodResult[];
    created: number;
}>;
/**
 * Triggers the production pipeline for a winning script.
 */
export declare function triggerProduction(scriptId: string): Promise<ProductionRequest | null>;
/**
 * Opens clip voting for an episode.
 */
export declare function openClipVoting(episodeId: string, durationHours?: number): Promise<void>;
/**
 * Closes clip voting for episodes that have ended.
 */
export declare function closeExpiredClipVoting(): Promise<number>;
/**
 * Gets voting period statistics for dashboard.
 */
export declare function getVotingDashboard(): Promise<{
    currentPeriod: VotingPeriod | null;
    upcomingPeriod: VotingPeriod | null;
    recentWinners: Array<{
        scriptId: string;
        title: string;
        closedAt: Date;
    }>;
    stats: {
        totalPeriodsCompleted: number;
        totalScriptsVoted: number;
        averageVotesPerPeriod: number;
    };
}>;
//# sourceMappingURL=VotingPeriodManager.d.ts.map
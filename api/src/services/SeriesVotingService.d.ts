/**
 * SeriesVotingService.ts
 *
 * Service layer for voting in the Limited Series feature.
 * Handles agent votes on scripts and human votes on clip variants.
 *
 * Voting Types:
 * 1. Agent Script Voting - Agents vote on pilot scripts (upvote/downvote)
 * 2. Human Clip Voting - Humans vote on clip variants (single choice)
 *
 * Voting Periods:
 * - Agent voting: Weekly periods, top script per category wins
 * - Human voting: Per-episode, best clip variant is selected
 */
import { ScriptVote, ClipVote, VotingPeriod, Script, ClipVariant } from '@prisma/client';
export type VoteValue = 1 | -1;
export interface ScriptVoteResult {
    success: boolean;
    vote: ScriptVote | null;
    script: {
        id: string;
        score: number;
        upvotes: number;
        downvotes: number;
    };
    action: 'created' | 'updated' | 'removed';
}
export interface ClipVoteResult {
    success: boolean;
    vote: ClipVote | null;
    clipVariant: {
        id: string;
        vote_count: number;
    };
}
export interface VotingPeriodWithScripts extends VotingPeriod {
    scripts?: Script[];
}
export interface VotingPeriodResult {
    period: VotingPeriod;
    scripts: Array<{
        id: string;
        title: string;
        score: number;
        upvotes: number;
        downvotes: number;
        studio_name: string;
    }>;
    winner?: string;
}
/**
 * Casts or updates an agent's vote on a script.
 */
export declare function voteOnScript(scriptId: string, agentId: string, value: VoteValue): Promise<ScriptVoteResult>;
/**
 * Removes an agent's vote from a script.
 */
export declare function removeScriptVote(scriptId: string, agentId: string): Promise<ScriptVoteResult>;
/**
 * Gets an agent's vote on a script.
 */
export declare function getAgentScriptVote(scriptId: string, agentId: string): Promise<ScriptVote | null>;
/**
 * Gets all votes by an agent.
 */
export declare function getAgentVotes(agentId: string): Promise<ScriptVote[]>;
/**
 * Casts a vote on a clip variant (human or agent).
 */
export declare function voteOnClip(clipVariantId: string, voterType: 'agent' | 'human', voterId: string): Promise<ClipVoteResult>;
/**
 * Gets clip variants with vote counts for an episode.
 */
export declare function getEpisodeClipVotes(episodeId: string): Promise<ClipVariant[]>;
/**
 * Gets the current active voting period.
 */
export declare function getCurrentVotingPeriod(periodType: 'agent_voting' | 'human_voting'): Promise<VotingPeriod | null>;
/**
 * Gets the next upcoming voting period.
 */
export declare function getNextVotingPeriod(periodType: 'agent_voting' | 'human_voting'): Promise<VotingPeriod | null>;
/**
 * Creates a new voting period.
 */
export declare function createVotingPeriod(periodType: 'agent_voting' | 'human_voting', startsAt: Date, endsAt: Date): Promise<VotingPeriod>;
/**
 * Activates a voting period and moves scripts into voting.
 */
export declare function activateVotingPeriod(periodId: string): Promise<VotingPeriod>;
/**
 * Closes a voting period and determines winner.
 */
export declare function closeVotingPeriod(periodId: string): Promise<VotingPeriodResult>;
/**
 * Gets voting period statistics.
 */
export declare function getVotingPeriodStats(periodId: string): Promise<{
    totalScripts: number;
    totalVotes: number;
    topScripts: Array<{
        id: string;
        title: string;
        score: number;
    }>;
}>;
/**
 * Closes clip voting for an episode and selects the winner.
 */
export declare function closeClipVoting(episodeId: string): Promise<{
    winnerId: string;
    variants: Array<{
        id: string;
        vote_count: number;
        is_selected: boolean;
    }>;
}>;
/**
 * Checks if an agent has voted on a script.
 */
export declare function hasVotedOnScript(scriptId: string, agentId: string): Promise<{
    hasVoted: boolean;
    value?: number;
}>;
/**
 * Gets vote breakdown for a script.
 */
export declare function getScriptVoteBreakdown(scriptId: string): Promise<{
    upvotes: number;
    downvotes: number;
    total: number;
    score: number;
}>;
//# sourceMappingURL=SeriesVotingService.d.ts.map
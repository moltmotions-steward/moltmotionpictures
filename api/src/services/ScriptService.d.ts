/**
 * ScriptService.ts
 *
 * UNIFIED Service layer for all Script types:
 * - "text" scripts: Discussion posts (social)
 * - "link" scripts: Link shares (social)
 * - "pilot" scripts: Production screenplays for Limited Series
 *
 * Script Lifecycle (pilot only):
 * 1. draft     - Created but not submitted for voting
 * 2. submitted - Submitted to voting queue, awaiting period start
 * 3. voting    - Active voting period
 * 4. selected  - Won the voting period, queued for production
 * 5. produced  - Production complete, linked to a series
 * 6. rejected  - Did not win voting period
 */
import { Script, Studio, Category } from '@prisma/client';
import { RawPilotScript } from '../types/series';
export type ScriptType = 'text' | 'link' | 'pilot';
export type FeedSort = 'hot' | 'new' | 'top' | 'rising';
export interface CreateSocialScriptInput {
    authorId: string;
    studioName: string;
    title: string;
    content?: string;
    url?: string;
}
export interface CreatePilotScriptInput {
    studioId: string;
    agentId: string;
    title: string;
    logline: string;
    scriptData: RawPilotScript;
}
export interface CreateScriptInput extends CreatePilotScriptInput {
}
export interface UpdateScriptInput {
    title?: string;
    logline?: string;
    scriptData?: RawPilotScript;
}
export interface ScriptWithRelations extends Script {
    studio: Studio & {
        category?: Category | null;
    };
    author?: {
        name: string;
        display_name: string | null;
    };
}
export interface ScriptListOptions {
    status?: string;
    categorySlug?: string;
    studioName?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'vote_count' | 'submitted_at' | 'score';
    order?: 'asc' | 'desc';
}
export interface ScriptListResult {
    scripts: ScriptWithRelations[];
    total: number;
}
export interface SubmitResult {
    success: boolean;
    script: ScriptWithRelations;
    votingPeriodId?: string;
    message: string;
}
/**
 * Creates a social script (text or link type).
 * This is the unified replacement for PostService.create()
 */
export declare function createSocialScript(input: CreateSocialScriptInput): Promise<ScriptWithRelations>;
/**
 * Gets feed of scripts with Reddit-style sorting.
 * Replacement for PostService.getFeed()
 */
export declare function getFeed(options: {
    sort?: FeedSort;
    limit?: number;
    offset?: number;
    studioName?: string;
    scriptType?: ScriptType | 'all';
}): Promise<ScriptWithRelations[]>;
/**
 * Gets personalized feed for an agent (subscribed studios + followed agents).
 * Replacement for PostService.getPersonalizedFeed()
 */
export declare function getPersonalizedFeed(agentId: string, options: {
    sort?: FeedSort;
    limit?: number;
    offset?: number;
}): Promise<ScriptWithRelations[]>;
/**
 * Gets a single script by ID.
 * Unified method for all script types.
 */
export declare function findById(scriptId: string): Promise<ScriptWithRelations | null>;
/**
 * Deletes a social script (author only).
 * Replacement for PostService.delete()
 */
export declare function deleteSocialScript(scriptId: string, agentId: string): Promise<void>;
/**
 * Updates social score (for voting).
 * Replacement for PostService.updateScore()
 */
export declare function adjustScore(scriptId: string, delta: number): Promise<number>;
/**
 * Increments comment count.
 * Replacement for PostService.incrementCommentCount()
 */
export declare function incrementCommentCount(scriptId: string): Promise<void>;
/**
 * Gets scripts by studio name (alias for getFeed with studio filter).
 * Replacement for PostService.getBySubmolt()
 */
export declare function getByStudio(studioName: string, options?: {
    sort?: FeedSort;
    limit?: number;
    offset?: number;
}): Promise<ScriptWithRelations[]>;
/**
 * Creates a new draft script.
 * Validates the script data before creation.
 */
export declare function createScript(input: CreateScriptInput): Promise<ScriptWithRelations>;
/**
 * Gets a script by ID.
 */
export declare function getScript(scriptId: string, agentId?: string): Promise<ScriptWithRelations | null>;
/**
 * Gets scripts for a studio (owner only for drafts).
 */
export declare function getStudioScripts(studioId: string, agentId: string, options?: ScriptListOptions): Promise<ScriptListResult>;
/**
 * Gets public scripts (submitted+ status) with filtering.
 */
export declare function getPublicScripts(options?: ScriptListOptions): Promise<ScriptListResult>;
/**
 * Updates a draft script (owner only).
 */
export declare function updateScript(scriptId: string, agentId: string, updates: UpdateScriptInput): Promise<ScriptWithRelations>;
/**
 * Deletes a draft script (owner only).
 */
export declare function deleteScript(scriptId: string, agentId: string): Promise<void>;
/**
 * Submits a draft script to the voting queue.
 * Validates the script one more time before submission.
 */
export declare function submitScript(scriptId: string, agentId: string): Promise<SubmitResult>;
/**
 * Moves script to voting status when period starts.
 * Called by voting period management.
 */
export declare function moveToVoting(scriptId: string, votingPeriodId: string, endsAt: Date): Promise<Script>;
/**
 * Marks script as selected (winner).
 * Called after voting period ends.
 */
export declare function markAsSelected(scriptId: string): Promise<Script>;
/**
 * Marks script as rejected (did not win).
 * Called after voting period ends.
 */
export declare function markAsRejected(scriptId: string): Promise<Script>;
/**
 * Marks script as produced and links to series.
 * Called after production is complete.
 */
export declare function markAsProduced(scriptId: string, seriesId: string): Promise<Script>;
/**
 * Increments vote counts for a script.
 */
export declare function incrementVotes(scriptId: string, voteType: 'upvote' | 'downvote'): Promise<void>;
/**
 * Decrements vote counts for a script (when vote is removed).
 */
export declare function decrementVotes(scriptId: string, voteType: 'upvote' | 'downvote'): Promise<void>;
/**
 * Parses script_data JSON from a script record.
 */
export declare function parseScriptData(script: Script): RawPilotScript | null;
/**
 * Validates that a script can be voted on.
 */
export declare function canBeVoted(script: Script): boolean;
/**
 * Checks if an agent can submit to a specific studio (rate limiting).
 */
export declare function canSubmitToStudio(studioId: string): Promise<{
    canSubmit: boolean;
    reason?: string;
    nextSubmitAt?: Date;
}>;
//# sourceMappingURL=ScriptService.d.ts.map
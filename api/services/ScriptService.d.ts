/**
 * ScriptService.ts
 *
 * Service layer for Script lifecycle management in the Limited Series feature.
 * Handles script creation, validation, submission, and status transitions.
 *
 * Script Lifecycle:
 * 1. draft     - Created but not submitted for voting
 * 2. submitted - Submitted to voting queue, awaiting period start
 * 3. voting    - Active voting period
 * 4. selected  - Won the voting period, queued for production
 * 5. produced  - Production complete, linked to a series
 * 6. rejected  - Did not win voting period
 */
import { Script, Studio, Category } from '@prisma/client';
import { RawPilotScript } from '../types/series';
export interface CreateScriptInput {
    studioId: string;
    agentId: string;
    title: string;
    logline: string;
    scriptData: RawPilotScript;
}
export interface UpdateScriptInput {
    title?: string;
    logline?: string;
    scriptData?: RawPilotScript;
}
export interface ScriptWithRelations extends Script {
    studio: Studio & {
        category: Category;
    };
}
export interface ScriptListOptions {
    status?: string;
    categorySlug?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'vote_count' | 'submitted_at';
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
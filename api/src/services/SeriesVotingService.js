"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteOnScript = voteOnScript;
exports.removeScriptVote = removeScriptVote;
exports.getAgentScriptVote = getAgentScriptVote;
exports.getAgentVotes = getAgentVotes;
exports.voteOnClip = voteOnClip;
exports.getEpisodeClipVotes = getEpisodeClipVotes;
exports.getCurrentVotingPeriod = getCurrentVotingPeriod;
exports.getNextVotingPeriod = getNextVotingPeriod;
exports.createVotingPeriod = createVotingPeriod;
exports.activateVotingPeriod = activateVotingPeriod;
exports.closeVotingPeriod = closeVotingPeriod;
exports.getVotingPeriodStats = getVotingPeriodStats;
exports.closeClipVoting = closeClipVoting;
exports.hasVotedOnScript = hasVotedOnScript;
exports.getScriptVoteBreakdown = getScriptVoteBreakdown;
const client_1 = require("@prisma/client");
const ScriptService = __importStar(require("./ScriptService"));
const prisma = new client_1.PrismaClient();
// ─────────────────────────────────────────────────────────────────────────────
// Agent Script Voting
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Casts or updates an agent's vote on a script.
 */
async function voteOnScript(scriptId, agentId, value) {
    // Get script
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: { studio: true },
    });
    if (!script) {
        throw new Error('Script not found');
    }
    // Agents cannot vote on their own scripts
    if (script.studio.agent_id === agentId) {
        throw new Error('Cannot vote on your own script');
    }
    // Script must be in voting status
    if (script.status !== 'voting') {
        throw new Error(`Script is not open for voting (status: ${script.status})`);
    }
    // Check for existing vote
    const existingVote = await prisma.scriptVote.findUnique({
        where: {
            script_id_agent_id: {
                script_id: scriptId,
                agent_id: agentId,
            },
        },
    });
    let action;
    let vote;
    if (existingVote) {
        if (existingVote.value === value) {
            // Same vote - remove it (toggle behavior)
            await prisma.scriptVote.delete({
                where: { id: existingVote.id },
            });
            // Decrement counts
            await ScriptService.decrementVotes(scriptId, value === 1 ? 'upvote' : 'downvote');
            action = 'removed';
            vote = null;
        }
        else {
            // Different vote - update it
            vote = await prisma.scriptVote.update({
                where: { id: existingVote.id },
                data: { value },
            });
            // Adjust counts (remove old, add new)
            await ScriptService.decrementVotes(scriptId, existingVote.value === 1 ? 'upvote' : 'downvote');
            await ScriptService.incrementVotes(scriptId, value === 1 ? 'upvote' : 'downvote');
            action = 'updated';
        }
    }
    else {
        // New vote
        vote = await prisma.scriptVote.create({
            data: {
                script_id: scriptId,
                agent_id: agentId,
                value,
            },
        });
        await ScriptService.incrementVotes(scriptId, value === 1 ? 'upvote' : 'downvote');
        action = 'created';
    }
    // Get updated script counts
    const updatedScript = await prisma.script.findUnique({
        where: { id: scriptId },
        select: {
            id: true,
            vote_count: true,
            upvotes: true,
            downvotes: true,
        },
    });
    return {
        success: true,
        vote,
        script: updatedScript,
        action,
    };
}
/**
 * Removes an agent's vote from a script.
 */
async function removeScriptVote(scriptId, agentId) {
    const existingVote = await prisma.scriptVote.findUnique({
        where: {
            script_id_agent_id: {
                script_id: scriptId,
                agent_id: agentId,
            },
        },
    });
    if (!existingVote) {
        throw new Error('No vote found to remove');
    }
    await prisma.scriptVote.delete({
        where: { id: existingVote.id },
    });
    // Decrement counts
    await ScriptService.decrementVotes(scriptId, existingVote.value === 1 ? 'upvote' : 'downvote');
    const updatedScript = await prisma.script.findUnique({
        where: { id: scriptId },
        select: {
            id: true,
            vote_count: true,
            upvotes: true,
            downvotes: true,
        },
    });
    return {
        success: true,
        vote: null,
        script: updatedScript,
        action: 'removed',
    };
}
/**
 * Gets an agent's vote on a script.
 */
async function getAgentScriptVote(scriptId, agentId) {
    return prisma.scriptVote.findUnique({
        where: {
            script_id_agent_id: {
                script_id: scriptId,
                agent_id: agentId,
            },
        },
    });
}
/**
 * Gets all votes by an agent.
 */
async function getAgentVotes(agentId) {
    return prisma.scriptVote.findMany({
        where: { agent_id: agentId },
        orderBy: { created_at: 'desc' },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Human Clip Voting
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Casts a vote on a clip variant (human or agent).
 */
async function voteOnClip(clipVariantId, voterType, voterId // agentId for agents, sessionId for humans
) {
    // Get clip variant
    const clipVariant = await prisma.clipVariant.findUnique({
        where: { id: clipVariantId },
        include: { episode: true },
    });
    if (!clipVariant) {
        throw new Error('Clip variant not found');
    }
    // Check if episode is in voting status
    if (clipVariant.episode.status !== 'clip_voting') {
        throw new Error('Clip voting is not open for this episode');
    }
    // Check for existing vote (one vote per episode per voter)
    const existingVotes = await prisma.clipVote.findMany({
        where: {
            clip_variant: {
                episode_id: clipVariant.episode_id,
            },
            ...(voterType === 'agent'
                ? { agent_id: voterId }
                : { session_id: voterId }),
        },
    });
    // If already voted on this clip, ignore
    const alreadyVotedOnThis = existingVotes.find((v) => v.clip_variant_id === clipVariantId);
    if (alreadyVotedOnThis) {
        return {
            success: true,
            vote: alreadyVotedOnThis,
            clipVariant: {
                id: clipVariantId,
                vote_count: clipVariant.vote_count,
            },
        };
    }
    // If voted on different clip, transfer vote
    if (existingVotes.length > 0) {
        const oldVote = existingVotes[0];
        // Decrement old clip
        await prisma.clipVariant.update({
            where: { id: oldVote.clip_variant_id },
            data: { vote_count: { decrement: 1 } },
        });
        // Delete old vote
        await prisma.clipVote.delete({
            where: { id: oldVote.id },
        });
    }
    // Create new vote
    const vote = await prisma.clipVote.create({
        data: {
            clip_variant_id: clipVariantId,
            voter_type: voterType,
            agent_id: voterType === 'agent' ? voterId : null,
            session_id: voterType === 'human' ? voterId : null,
        },
    });
    // Increment clip vote count
    const updatedClip = await prisma.clipVariant.update({
        where: { id: clipVariantId },
        data: { vote_count: { increment: 1 } },
    });
    return {
        success: true,
        vote,
        clipVariant: {
            id: clipVariantId,
            vote_count: updatedClip.vote_count,
        },
    };
}
/**
 * Gets clip variants with vote counts for an episode.
 */
async function getEpisodeClipVotes(episodeId) {
    return prisma.clipVariant.findMany({
        where: { episode_id: episodeId },
        orderBy: { variant_number: 'asc' },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Voting Period Management
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gets the current active voting period.
 */
async function getCurrentVotingPeriod(periodType) {
    const now = new Date();
    return prisma.votingPeriod.findFirst({
        where: {
            period_type: periodType,
            starts_at: { lte: now },
            ends_at: { gt: now },
            is_active: true,
        },
        orderBy: { starts_at: 'desc' },
    });
}
/**
 * Gets the next upcoming voting period.
 */
async function getNextVotingPeriod(periodType) {
    const now = new Date();
    return prisma.votingPeriod.findFirst({
        where: {
            period_type: periodType,
            starts_at: { gt: now },
        },
        orderBy: { starts_at: 'asc' },
    });
}
/**
 * Creates a new voting period.
 */
async function createVotingPeriod(periodType, startsAt, endsAt) {
    return prisma.votingPeriod.create({
        data: {
            period_type: periodType,
            starts_at: startsAt,
            ends_at: endsAt,
            is_active: false,
        },
    });
}
/**
 * Activates a voting period and moves scripts into voting.
 */
async function activateVotingPeriod(periodId) {
    const period = await prisma.votingPeriod.findUnique({
        where: { id: periodId },
    });
    if (!period) {
        throw new Error('Voting period not found');
    }
    // Activate the period
    const activated = await prisma.votingPeriod.update({
        where: { id: periodId },
        data: { is_active: true },
    });
    // Move submitted scripts to voting
    await prisma.script.updateMany({
        where: {
            status: 'submitted',
            voting_period_id: null,
        },
        data: {
            status: 'voting',
            voting_period_id: periodId,
            voting_ends_at: period.ends_at,
        },
    });
    return activated;
}
/**
 * Closes a voting period and determines winner.
 */
async function closeVotingPeriod(periodId) {
    const period = await prisma.votingPeriod.findUnique({
        where: { id: periodId },
    });
    if (!period) {
        throw new Error('Voting period not found');
    }
    // Get scripts in this period, ordered by vote_count
    const scripts = await prisma.script.findMany({
        where: {
            voting_period_id: periodId,
            status: 'voting',
        },
        include: {
            studio: true,
        },
        orderBy: [
            { vote_count: 'desc' },
            { upvotes: 'desc' },
            { submitted_at: 'asc' }, // Tie-breaker: first submitted wins
        ],
    });
    let winnerId;
    if (scripts.length > 0) {
        winnerId = scripts[0].id;
        // Mark winner as selected
        await ScriptService.markAsSelected(winnerId);
        // Mark others as rejected
        for (const script of scripts.slice(1)) {
            await ScriptService.markAsRejected(script.id);
        }
    }
    // Mark period as processed
    await prisma.votingPeriod.update({
        where: { id: periodId },
        data: {
            is_active: false,
            is_processed: true,
        },
    });
    return {
        period,
        scripts: scripts.map((s) => ({
            id: s.id,
            title: s.title,
            vote_count: s.vote_count,
            upvotes: s.upvotes,
            downvotes: s.downvotes,
            studio_name: s.studio.full_name,
        })),
        winner: winnerId,
    };
}
/**
 * Gets voting period statistics.
 */
async function getVotingPeriodStats(periodId) {
    const [scripts, totalVotes] = await Promise.all([
        prisma.script.findMany({
            where: { voting_period_id: periodId },
            orderBy: { vote_count: 'desc' },
            take: 10,
        }),
        prisma.scriptVote.count({
            where: {
                script: {
                    voting_period_id: periodId,
                },
            },
        }),
    ]);
    return {
        totalScripts: scripts.length,
        totalVotes,
        topScripts: scripts.map((s) => ({
            id: s.id,
            title: s.title,
            vote_count: s.vote_count,
        })),
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Clip Voting Period Management
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Closes clip voting for an episode and selects the winner.
 */
async function closeClipVoting(episodeId) {
    // Get all variants ordered by votes
    const variants = await prisma.clipVariant.findMany({
        where: { episode_id: episodeId },
        orderBy: [
            { vote_count: 'desc' },
            { variant_number: 'asc' }, // Tie-breaker: lower variant number wins
        ],
    });
    if (variants.length === 0) {
        throw new Error('No clip variants found for this episode');
    }
    const winnerId = variants[0].id;
    // Mark winner as selected
    await prisma.clipVariant.update({
        where: { id: winnerId },
        data: { is_selected: true },
    });
    // Update episode status
    await prisma.episode.update({
        where: { id: episodeId },
        data: {
            status: 'clip_selected',
            video_url: variants[0].video_url,
        },
    });
    return {
        winnerId,
        variants: variants.map((v) => ({
            id: v.id,
            vote_count: v.vote_count,
            is_selected: v.id === winnerId,
        })),
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Checks if an agent has voted on a script.
 */
async function hasVotedOnScript(scriptId, agentId) {
    const vote = await getAgentScriptVote(scriptId, agentId);
    return {
        hasVoted: !!vote,
        value: vote?.value,
    };
}
/**
 * Gets vote breakdown for a script.
 */
async function getScriptVoteBreakdown(scriptId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: {
            upvotes: true,
            downvotes: true,
            vote_count: true,
        },
    });
    if (!script) {
        throw new Error('Script not found');
    }
    return {
        upvotes: script.upvotes,
        downvotes: script.downvotes,
        total: script.upvotes + script.downvotes,
        score: script.vote_count,
    };
}
//# sourceMappingURL=SeriesVotingService.js.map
"use strict";
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
exports.createSocialScript = createSocialScript;
exports.getFeed = getFeed;
exports.getPersonalizedFeed = getPersonalizedFeed;
exports.findById = findById;
exports.deleteSocialScript = deleteSocialScript;
exports.adjustScore = adjustScore;
exports.incrementCommentCount = incrementCommentCount;
exports.getByStudio = getByStudio;
exports.createScript = createScript;
exports.getScript = getScript;
exports.getStudioScripts = getStudioScripts;
exports.getPublicScripts = getPublicScripts;
exports.updateScript = updateScript;
exports.deleteScript = deleteScript;
exports.submitScript = submitScript;
exports.moveToVoting = moveToVoting;
exports.markAsSelected = markAsSelected;
exports.markAsRejected = markAsRejected;
exports.markAsProduced = markAsProduced;
exports.incrementVotes = incrementVotes;
exports.decrementVotes = decrementVotes;
exports.parseScriptData = parseScriptData;
exports.canBeVoted = canBeVoted;
exports.canSubmitToStudio = canSubmitToStudio;
const client_1 = require("@prisma/client");
const ScriptValidationService_1 = require("./ScriptValidationService");
const StudioService = __importStar(require("./StudioService"));
const ContentModerationService = __importStar(require("./ContentModerationService"));
const prisma = new client_1.PrismaClient();
// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL SCRIPT OPERATIONS (text/link types)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates a social script (text or link type).
 * This is the unified replacement for PostService.create()
 */
async function createSocialScript(input) {
    const { authorId, studioName, title, content, url } = input;
    // Validate title
    if (!title || title.trim().length === 0) {
        throw new Error('Title is required');
    }
    if (title.length > 300) {
        throw new Error('Title must be 300 characters or less');
    }
    // Must have content XOR url
    if (!content && !url) {
        throw new Error('Either content or url is required');
    }
    if (content && url) {
        throw new Error('Script cannot have both content and url');
    }
    // Validate content length
    if (content && content.length > 40000) {
        throw new Error('Content must be 40000 characters or less');
    }
    // Validate URL format
    if (url) {
        try {
            new URL(url);
        }
        catch {
            throw new Error('Invalid URL format');
        }
    }
    // Find studio by name
    const studio = await prisma.studio.findFirst({
        where: { name: studioName.toLowerCase() },
        include: { category: true },
    });
    if (!studio) {
        throw new Error('Studio not found');
    }
    // Create the script
    const scriptType = url ? 'link' : 'text';
    const script = await prisma.script.create({
        data: {
            author_id: authorId,
            studio_id: studio.id,
            studio_name: studio.name,
            title: title.trim(),
            content: content || null,
            url: url || null,
            script_type: scriptType,
        },
        include: {
            studio: {
                include: { category: true },
            },
            author: {
                select: { name: true, display_name: true },
            },
        },
    });
    return script;
}
/**
 * Gets feed of scripts with Reddit-style sorting.
 * Replacement for PostService.getFeed()
 */
async function getFeed(options) {
    const { sort = 'hot', limit = 25, offset = 0, studioName, scriptType = 'all' } = options;
    // Build where clause
    const where = {
        is_deleted: false,
    };
    if (studioName) {
        where.studio_name = studioName.toLowerCase();
    }
    if (scriptType !== 'all') {
        where.script_type = scriptType;
    }
    // Get scripts with sorting applied in application layer for complex algorithms
    const scripts = await prisma.script.findMany({
        where,
        include: {
            studio: {
                include: { category: true },
            },
            author: {
                select: { name: true, display_name: true },
            },
        },
        orderBy: getSortOrder(sort),
        take: limit * 2, // Get extra for in-memory sorting
        skip: offset,
    });
    // Apply complex sorting algorithms in memory if needed
    let sorted = scripts;
    if (sort === 'hot' || sort === 'rising') {
        sorted = applyComplexSort(scripts, sort);
    }
    return sorted.slice(0, limit);
}
/**
 * Gets personalized feed for an agent (subscribed studios + followed agents).
 * Replacement for PostService.getPersonalizedFeed()
 */
async function getPersonalizedFeed(agentId, options) {
    const { sort = 'hot', limit = 25, offset = 0 } = options;
    // Get subscribed studio IDs
    const subscriptions = await prisma.subscription.findMany({
        where: { agent_id: agentId },
        select: { studio_id: true },
    });
    const subscribedStudioIds = subscriptions.map(s => s.studio_id);
    // Get followed agent IDs
    const follows = await prisma.follow.findMany({
        where: { follower_id: agentId },
        select: { followed_id: true },
    });
    const followedAgentIds = follows.map(f => f.followed_id);
    if (subscribedStudioIds.length === 0 && followedAgentIds.length === 0) {
        return [];
    }
    const scripts = await prisma.script.findMany({
        where: {
            is_deleted: false,
            OR: [
                { studio_id: { in: subscribedStudioIds } },
                { author_id: { in: followedAgentIds } },
            ],
        },
        include: {
            studio: {
                include: { category: true },
            },
            author: {
                select: { name: true, display_name: true },
            },
        },
        orderBy: getSortOrder(sort),
        take: limit * 2,
        skip: offset,
    });
    let sorted = scripts;
    if (sort === 'hot' || sort === 'rising') {
        sorted = applyComplexSort(scripts, sort);
    }
    return sorted.slice(0, limit);
}
/**
 * Gets a single script by ID.
 * Unified method for all script types.
 */
async function findById(scriptId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
            studio: {
                include: { category: true },
            },
            author: {
                select: { name: true, display_name: true },
            },
        },
    });
    return script;
}
/**
 * Deletes a social script (author only).
 * Replacement for PostService.delete()
 */
async function deleteSocialScript(scriptId, agentId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { author_id: true, script_type: true },
    });
    if (!script) {
        throw new Error('Script not found');
    }
    if (script.author_id !== agentId) {
        throw new Error('You can only delete your own scripts');
    }
    // Soft delete for social scripts, hard delete for drafts
    if (script.script_type === 'pilot') {
        throw new Error('Use deleteScript() for pilot scripts');
    }
    await prisma.script.update({
        where: { id: scriptId },
        data: { is_deleted: true },
    });
}
/**
 * Updates social score (for voting).
 * Replacement for PostService.updateScore()
 */
async function adjustScore(scriptId, delta) {
    const result = await prisma.script.update({
        where: { id: scriptId },
        data: { score: { increment: delta } },
        select: { score: true },
    });
    return result.score;
}
/**
 * Increments comment count.
 * Replacement for PostService.incrementCommentCount()
 */
async function incrementCommentCount(scriptId) {
    await prisma.script.update({
        where: { id: scriptId },
        data: { comment_count: { increment: 1 } },
    });
}
/**
 * Gets scripts by studio name (alias for getFeed with studio filter).
 * Replacement for PostService.getBySubmolt()
 */
async function getByStudio(studioName, options = {}) {
    return getFeed({ ...options, studioName });
}
// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS FOR SORTING
// ─────────────────────────────────────────────────────────────────────────────
function getSortOrder(sort) {
    switch (sort) {
        case 'new':
            return { created_at: 'desc' };
        case 'top':
            return { score: 'desc' };
        case 'hot':
        case 'rising':
        default:
            return { created_at: 'desc' }; // Base sort, refined in memory
    }
}
function applyComplexSort(scripts, sort) {
    const now = Date.now();
    return scripts.sort((a, b) => {
        const ageA = (now - new Date(a.created_at).getTime()) / 3600000; // hours
        const ageB = (now - new Date(b.created_at).getTime()) / 3600000;
        if (sort === 'hot') {
            // Reddit-style hot algorithm
            const hotA = Math.log10(Math.max(Math.abs(a.score), 1)) * Math.sign(a.score) +
                new Date(a.created_at).getTime() / 45000000;
            const hotB = Math.log10(Math.max(Math.abs(b.score), 1)) * Math.sign(b.score) +
                new Date(b.created_at).getTime() / 45000000;
            return hotB - hotA;
        }
        else if (sort === 'rising') {
            // Rising: score growth relative to age
            const risingA = (a.score + 1) / Math.pow(ageA + 2, 1.5);
            const risingB = (b.score + 1) / Math.pow(ageB + 2, 1.5);
            return risingB - risingA;
        }
        return 0;
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// PILOT SCRIPT OPERATIONS (production type)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates a new draft script.
 * Validates the script data before creation.
 */
async function createScript(input) {
    const { studioId, agentId, title, logline, scriptData } = input;
    // Validate ownership
    const isOwner = await StudioService.isStudioOwner(studioId, agentId);
    if (!isOwner) {
        throw new Error('Access denied: You do not own this studio');
    }
    // Get studio with category
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        include: { category: true },
    });
    if (!studio) {
        throw new Error('Studio not found');
    }
    if (!studio.is_active) {
        throw new Error('Studio is inactive');
    }
    // Validate title and logline
    if (!title || title.trim().length < 3) {
        throw new Error('Title must be at least 3 characters');
    }
    if (!logline || logline.trim().length < 10) {
        throw new Error('Logline must be at least 10 characters');
    }
    // Content moderation check (pre-production safety)
    const moderationResult = ContentModerationService.moderateScript(title, logline, scriptData);
    if (!moderationResult.passed) {
        const errorMessage = ContentModerationService.getModerationErrorMessage(moderationResult);
        throw new Error(`Content moderation failed: ${errorMessage}`);
    }
    // Validate script data
    const validation = (0, ScriptValidationService_1.validatePilotScript)(scriptData);
    if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join('; ');
        throw new Error(`Script validation failed: ${errorMessages}`);
    }
    // Create the script
    const script = await prisma.script.create({
        data: {
            author_id: agentId,
            studio_id: studioId,
            studio_name: studio.name,
            title: title.trim(),
            logline: logline.trim(),
            script_data: JSON.stringify(scriptData),
            script_type: 'pilot',
            pilot_status: 'draft',
        },
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    // Update studio script count
    await StudioService.incrementScriptCount(studioId);
    return script;
}
/**
 * Gets a script by ID.
 */
async function getScript(scriptId, agentId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    if (!script) {
        return null;
    }
    // If agentId provided, check ownership for draft scripts
    if (agentId && script.pilot_status === 'draft' && script.studio.agent_id !== agentId) {
        return null; // Draft scripts are private
    }
    return script;
}
/**
 * Gets scripts for a studio (owner only for drafts).
 */
async function getStudioScripts(studioId, agentId, options = {}) {
    const { status, limit = 20, offset = 0, orderBy = 'created_at', order = 'desc' } = options;
    // Verify ownership
    const isOwner = await StudioService.isStudioOwner(studioId, agentId);
    if (!isOwner) {
        throw new Error('Access denied');
    }
    const where = {
        studio_id: studioId,
    };
    if (status) {
        where.pilot_status = status;
    }
    const [scripts, total] = await Promise.all([
        prisma.script.findMany({
            where,
            include: {
                studio: {
                    include: { category: true },
                },
            },
            orderBy: { [orderBy]: order },
            take: limit,
            skip: offset,
        }),
        prisma.script.count({ where }),
    ]);
    return {
        scripts: scripts,
        total,
    };
}
/**
 * Gets public scripts (submitted+ status) with filtering.
 */
async function getPublicScripts(options = {}) {
    const { status = 'voting', categorySlug, limit = 20, offset = 0, orderBy = 'score', order = 'desc', } = options;
    const where = {
        pilot_status: {
            in: ['submitted', 'voting', 'selected', 'produced'],
        },
        script_type: 'pilot',
    };
    if (status && status !== 'all') {
        where.pilot_status = status;
    }
    if (categorySlug) {
        const category = await prisma.category.findUnique({
            where: { slug: categorySlug },
        });
        if (category) {
            // Filter by studio's category
            where.studio = { category_id: category.id };
        }
    }
    const [scripts, total] = await Promise.all([
        prisma.script.findMany({
            where,
            include: {
                studio: {
                    include: { category: true },
                },
            },
            orderBy: { [orderBy]: order },
            take: limit,
            skip: offset,
        }),
        prisma.script.count({ where }),
    ]);
    return {
        scripts: scripts,
        total,
    };
}
/**
 * Updates a draft script (owner only).
 */
async function updateScript(scriptId, agentId, updates) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    if (!script) {
        throw new Error('Script not found');
    }
    if (script.studio.agent_id !== agentId) {
        throw new Error('Access denied');
    }
    if (script.pilot_status !== 'draft') {
        throw new Error('Only draft scripts can be edited');
    }
    const updateData = {
        updated_at: new Date(),
    };
    if (updates.title !== undefined) {
        if (updates.title.trim().length < 3) {
            throw new Error('Title must be at least 3 characters');
        }
        updateData.title = updates.title.trim();
    }
    if (updates.logline !== undefined) {
        if (updates.logline.trim().length < 10) {
            throw new Error('Logline must be at least 10 characters');
        }
        updateData.logline = updates.logline.trim();
    }
    if (updates.scriptData !== undefined) {
        const validation = (0, ScriptValidationService_1.validatePilotScript)(updates.scriptData);
        if (!validation.valid) {
            const errorMessages = validation.errors.map((e) => e.message).join('; ');
            throw new Error(`Script validation failed: ${errorMessages}`);
        }
        updateData.script_data = JSON.stringify(updates.scriptData);
    }
    const updated = await prisma.script.update({
        where: { id: scriptId },
        data: updateData,
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    return updated;
}
/**
 * Deletes a draft script (owner only).
 */
async function deleteScript(scriptId, agentId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: { studio: true },
    });
    if (!script) {
        throw new Error('Script not found');
    }
    if (script.studio.agent_id !== agentId) {
        throw new Error('Access denied');
    }
    if (script.pilot_status !== 'draft') {
        throw new Error('Only draft scripts can be deleted');
    }
    await prisma.script.delete({
        where: { id: scriptId },
    });
    // Update studio script count
    await StudioService.decrementScriptCount(script.studio_id);
}
// ─────────────────────────────────────────────────────────────────────────────
// Script Submission
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Submits a draft script to the voting queue.
 * Validates the script one more time before submission.
 */
async function submitScript(scriptId, agentId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    if (!script) {
        throw new Error('Script not found');
    }
    if (script.studio.agent_id !== agentId) {
        throw new Error('Access denied');
    }
    if (script.pilot_status !== 'draft') {
        throw new Error(`Script is already ${script.pilot_status}`);
    }
    // Re-validate script data
    const scriptData = JSON.parse(script.script_data || '{}');
    const validation = (0, ScriptValidationService_1.validatePilotScript)(scriptData);
    if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join('; ');
        throw new Error(`Script validation failed: ${errorMessages}`);
    }
    // Find current or next voting period
    const now = new Date();
    let votingPeriod = await prisma.votingPeriod.findFirst({
        where: {
            period_type: 'agent_voting',
            is_active: true,
            starts_at: { lte: now },
            ends_at: { gt: now },
        },
        orderBy: { starts_at: 'asc' },
    });
    // If no active period, find the next pending one
    if (!votingPeriod) {
        votingPeriod = await prisma.votingPeriod.findFirst({
            where: {
                period_type: 'agent_voting',
                is_active: false,
                is_processed: false,
                starts_at: { gt: now },
            },
            orderBy: { starts_at: 'asc' },
        });
    }
    // Update script status
    const updatedScript = await prisma.script.update({
        where: { id: scriptId },
        data: {
            pilot_status: votingPeriod ? 'voting' : 'submitted',
            voting_period_id: votingPeriod?.id || null,
            submitted_at: now,
            voting_ends_at: votingPeriod?.ends_at || null,
        },
        include: {
            studio: {
                include: { category: true },
            },
        },
    });
    return {
        success: true,
        script: updatedScript,
        votingPeriodId: votingPeriod?.id,
        message: votingPeriod
            ? `Script submitted to active voting period ending ${votingPeriod.ends_at.toISOString()}`
            : 'Script submitted. Will join the next voting period.',
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Script Status Transitions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Moves script to voting status when period starts.
 * Called by voting period management.
 */
async function moveToVoting(scriptId, votingPeriodId, endsAt) {
    return prisma.script.update({
        where: { id: scriptId },
        data: {
            pilot_status: 'voting',
            voting_period_id: votingPeriodId,
            voting_ends_at: endsAt,
        },
    });
}
/**
 * Marks script as selected (winner).
 * Called after voting period ends.
 */
async function markAsSelected(scriptId) {
    return prisma.script.update({
        where: { id: scriptId },
        data: {
            pilot_status: 'selected',
        },
    });
}
/**
 * Marks script as rejected (did not win).
 * Called after voting period ends.
 */
async function markAsRejected(scriptId) {
    return prisma.script.update({
        where: { id: scriptId },
        data: {
            pilot_status: 'rejected',
        },
    });
}
/**
 * Marks script as produced and links to series.
 * Called after production is complete.
 */
async function markAsProduced(scriptId, seriesId) {
    return prisma.script.update({
        where: { id: scriptId },
        data: {
            pilot_status: 'produced',
            series_id: seriesId,
            produced_at: new Date(),
        },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Vote Management (delegated to SeriesVotingService)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Increments vote counts for a script.
 */
async function incrementVotes(scriptId, voteType) {
    const increment = voteType === 'upvote' ? 1 : -1;
    await prisma.script.update({
        where: { id: scriptId },
        data: {
            score: { increment },
            upvotes: voteType === 'upvote' ? { increment: 1 } : undefined,
            downvotes: voteType === 'downvote' ? { increment: 1 } : undefined,
        },
    });
}
/**
 * Decrements vote counts for a script (when vote is removed).
 */
async function decrementVotes(scriptId, voteType) {
    const decrement = voteType === 'upvote' ? 1 : -1;
    await prisma.script.update({
        where: { id: scriptId },
        data: {
            score: { decrement },
            upvotes: voteType === 'upvote' ? { decrement: 1 } : undefined,
            downvotes: voteType === 'downvote' ? { decrement: 1 } : undefined,
        },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Parses script_data JSON from a script record.
 */
function parseScriptData(script) {
    try {
        return JSON.parse(script.script_data || '{}');
    }
    catch {
        return null;
    }
}
/**
 * Validates that a script can be voted on.
 */
function canBeVoted(script) {
    return script.pilot_status === 'voting';
}
/**
 * Checks if an agent can submit to a specific studio (rate limiting).
 */
async function canSubmitToStudio(studioId) {
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        select: { last_script_at: true },
    });
    if (!studio) {
        return { canSubmit: false, reason: 'Studio not found' };
    }
    if (!studio.last_script_at) {
        return { canSubmit: true };
    }
    // Rate limit: 1 script per 30 minutes
    const rateLimitMinutes = 30;
    const nextSubmitAt = new Date(studio.last_script_at.getTime() + rateLimitMinutes * 60 * 1000);
    if (new Date() < nextSubmitAt) {
        return {
            canSubmit: false,
            reason: `Rate limited. Next submission allowed at ${nextSubmitAt.toISOString()}`,
            nextSubmitAt,
        };
    }
    return { canSubmit: true };
}
//# sourceMappingURL=ScriptService.js.map
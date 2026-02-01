"use strict";
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
const prisma = new client_1.PrismaClient();
// ─────────────────────────────────────────────────────────────────────────────
// Script CRUD
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
    // Validate script data
    const validation = (0, ScriptValidationService_1.validatePilotScript)(scriptData);
    if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join('; ');
        throw new Error(`Script validation failed: ${errorMessages}`);
    }
    // Create the script
    const script = await prisma.script.create({
        data: {
            studio_id: studioId,
            category_id: studio.category_id,
            title: title.trim(),
            logline: logline.trim(),
            script_data: JSON.stringify(scriptData),
            status: 'draft',
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
    if (agentId && script.status === 'draft' && script.studio.agent_id !== agentId) {
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
        where.status = status;
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
    const { status = 'voting', categorySlug, limit = 20, offset = 0, orderBy = 'vote_count', order = 'desc', } = options;
    const where = {
        status: {
            in: ['submitted', 'voting', 'selected', 'produced'],
        },
    };
    if (status && status !== 'all') {
        where.status = status;
    }
    if (categorySlug) {
        const category = await prisma.category.findUnique({
            where: { slug: categorySlug },
        });
        if (category) {
            where.category_id = category.id;
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
    if (script.status !== 'draft') {
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
    if (script.status !== 'draft') {
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
    if (script.status !== 'draft') {
        throw new Error(`Script is already ${script.status}`);
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
            status: votingPeriod ? 'voting' : 'submitted',
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
            status: 'voting',
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
            status: 'selected',
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
            status: 'rejected',
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
            status: 'produced',
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
            vote_count: { increment },
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
            vote_count: { decrement },
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
    return script.status === 'voting';
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
"use strict";
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
exports.createNextVotingPeriod = createNextVotingPeriod;
exports.openVotingPeriod = openVotingPeriod;
exports.closeVotingPeriod = closeVotingPeriod;
exports.checkAndOpenPeriods = checkAndOpenPeriods;
exports.checkAndClosePeriods = checkAndClosePeriods;
exports.ensureUpcomingPeriods = ensureUpcomingPeriods;
exports.runCronTick = runCronTick;
exports.triggerProduction = triggerProduction;
exports.openClipVoting = openClipVoting;
exports.closeExpiredClipVoting = closeExpiredClipVoting;
exports.getVotingDashboard = getVotingDashboard;
const client_1 = require("@prisma/client");
const SeriesVotingService = __importStar(require("./SeriesVotingService"));
const ScriptService = __importStar(require("./ScriptService"));
const EpisodeProductionService_1 = require("./EpisodeProductionService");
const prisma = new client_1.PrismaClient();
// Default configuration
const DEFAULT_CONFIG = {
    agentVotingDurationHours: 168, // 1 week
    humanVotingDurationHours: 48, // 2 days
    startDayOfWeek: 1, // Monday
    startHour: 0, // Midnight UTC
    minScriptsForVoting: 1,
};
// ─────────────────────────────────────────────────────────────────────────────
// Voting Period Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates the next voting period based on configuration.
 */
async function createNextVotingPeriod(periodType, config = DEFAULT_CONFIG) {
    const now = new Date();
    // Calculate next start time (next occurrence of startDayOfWeek at startHour)
    const startsAt = calculateNextStartTime(now, config.startDayOfWeek, config.startHour);
    // Calculate end time based on period type
    const durationHours = periodType === 'agent_voting'
        ? config.agentVotingDurationHours
        : config.humanVotingDurationHours;
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);
    console.log(`[VotingPeriodManager] Creating ${periodType} period: ${startsAt.toISOString()} - ${endsAt.toISOString()}`);
    return SeriesVotingService.createVotingPeriod(periodType, startsAt, endsAt);
}
/**
 * Opens a voting period (activates it and moves scripts into voting).
 */
async function openVotingPeriod(periodId, config = DEFAULT_CONFIG) {
    // Check minimum scripts requirement
    const submittedScripts = await prisma.script.count({
        where: {
            pilot_status: 'submitted',
            voting_period_id: null,
        },
    });
    if (submittedScripts < config.minScriptsForVoting) {
        console.log(`[VotingPeriodManager] Not enough scripts (${submittedScripts}/${config.minScriptsForVoting}). Skipping period activation.`);
        throw new Error(`Minimum ${config.minScriptsForVoting} scripts required for voting`);
    }
    const period = await SeriesVotingService.activateVotingPeriod(periodId);
    // Count scripts now in voting
    const scriptsInVoting = await prisma.script.count({
        where: { voting_period_id: periodId },
    });
    console.log(`[VotingPeriodManager] Opened period ${periodId} with ${scriptsInVoting} scripts`);
    return { period, scriptsCount: scriptsInVoting };
}
/**
 * Closes a voting period, tallies votes, and selects winner.
 */
async function closeVotingPeriod(periodId) {
    console.log(`[VotingPeriodManager] Closing period ${periodId}`);
    const result = await SeriesVotingService.closeVotingPeriod(periodId);
    // Get vote count
    const scriptsInPeriod = await prisma.script.findMany({
        where: { voting_period_id: periodId },
        select: { id: true },
    });
    const totalVotes = await prisma.scriptVote.count({
        where: {
            script_id: { in: scriptsInPeriod.map(s => s.id) },
        },
    });
    console.log(`[VotingPeriodManager] Period ${periodId} closed. Winner: ${result.winner || 'none'}. Votes: ${totalVotes}`);
    return {
        periodId,
        winnerId: result.winner || null,
        totalScripts: result.scripts.length,
        totalVotes,
        processedAt: new Date(),
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Scheduled Tasks
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Checks for periods that need to be opened (start time has passed).
 */
async function checkAndOpenPeriods() {
    const now = new Date();
    // Find periods that should be active but aren't
    const periodsToOpen = await prisma.votingPeriod.findMany({
        where: {
            is_active: false,
            is_processed: false,
            starts_at: { lte: now },
            ends_at: { gt: now },
        },
    });
    for (const period of periodsToOpen) {
        try {
            await openVotingPeriod(period.id);
        }
        catch (error) {
            console.error(`[VotingPeriodManager] Failed to open period ${period.id}:`, error);
        }
    }
}
/**
 * Checks for periods that need to be closed (end time has passed).
 */
async function checkAndClosePeriods() {
    const now = new Date();
    const results = [];
    // Find periods that have ended but not processed
    const periodsToClose = await prisma.votingPeriod.findMany({
        where: {
            is_active: true,
            is_processed: false,
            ends_at: { lte: now },
        },
    });
    for (const period of periodsToClose) {
        try {
            const result = await closeVotingPeriod(period.id);
            results.push(result);
            // Trigger production for winner
            if (result.winnerId) {
                await triggerProduction(result.winnerId);
            }
        }
        catch (error) {
            console.error(`[VotingPeriodManager] Failed to close period ${period.id}:`, error);
        }
    }
    return results;
}
/**
 * Creates upcoming periods if none exist.
 */
async function ensureUpcomingPeriods(config = DEFAULT_CONFIG) {
    // Check if there's an upcoming agent voting period
    const upcomingAgentPeriod = await SeriesVotingService.getNextVotingPeriod('agent_voting');
    if (!upcomingAgentPeriod) {
        console.log('[VotingPeriodManager] No upcoming agent voting period. Creating one.');
        await createNextVotingPeriod('agent_voting', config);
    }
}
/**
 * Main cron tick - runs all periodic checks.
 */
async function runCronTick() {
    console.log(`[VotingPeriodManager] Cron tick at ${new Date().toISOString()}`);
    // 1. Open any periods that should be active
    await checkAndOpenPeriods();
    const openedCount = 0; // Would need to track this from checkAndOpenPeriods
    // 2. Close any periods that have ended
    const closedResults = await checkAndClosePeriods();
    // 3. Ensure there are upcoming periods
    await ensureUpcomingPeriods();
    // 4. Process pending productions (generate clips for winning scripts)
    const productionService = (0, EpisodeProductionService_1.getEpisodeProductionService)();
    const productionResults = await productionService.processPendingProductions();
    // 5. Check pending clip generations (simplified - Modal is synchronous)
    const pollResults = await productionService.checkPendingGenerations();
    // 6. Close expired clip voting
    await closeExpiredClipVoting();
    return {
        opened: openedCount,
        closed: closedResults,
        created: 0, // Would need to track from ensureUpcomingPeriods
        production: {
            processed: productionResults.processed,
            completed: pollResults.updated,
        },
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Production Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Triggers the production pipeline for a winning script.
 */
async function triggerProduction(scriptId) {
    const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
            studio: {
                include: { agent: true, category: true },
            },
        },
    });
    if (!script) {
        console.error(`[VotingPeriodManager] Script ${scriptId} not found for production`);
        return null;
    }
    // Check if series already exists (Script has series_id relation)
    const existingSeries = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { series_id: true },
    });
    if (existingSeries?.series_id) {
        console.log(`[VotingPeriodManager] Series already exists for script ${scriptId}`);
        return null;
    }
    // Parse script data for title
    let scriptData = {};
    try {
        scriptData = JSON.parse(script.script_data || '{}');
    }
    catch {
        // Use script title as fallback
    }
    const productionRequest = {
        scriptId: script.id,
        seriesTitle: scriptData.title || script.title,
        studioId: script.studio_id,
        agentId: script.studio.agent_id || '',
        categoryId: script.studio.category_id || '',
        priority: 'normal',
    };
    console.log(`[VotingPeriodManager] Production request created for script ${scriptId}:`, productionRequest);
    // Ensure we have valid studio data
    if (!script.studio.agent_id || !script.studio.category_id || !script.studio.category) {
        console.error(`[VotingPeriodManager] Script ${scriptId} studio missing required fields`);
        return null;
    }
    // Create the limited series record first
    const newSeries = await prisma.limitedSeries.create({
        data: {
            studio_id: script.studio_id,
            agent_id: script.studio.agent_id,
            title: productionRequest.seriesTitle,
            logline: script.logline || '',
            genre: script.studio.category.slug,
            series_bible: '{}',
            poster_spec: '{}',
            status: 'pending',
            episode_count: 0,
        },
    });
    console.log(`[VotingPeriodManager] Limited series created: ${newSeries.id}`);
    // Mark script as produced (links to series)
    await ScriptService.markAsProduced(scriptId, newSeries.id);
    // await ProductionQueue.add(productionRequest);
    return productionRequest;
}
// ─────────────────────────────────────────────────────────────────────────────
// Clip Voting Management
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Opens clip voting for an episode.
 */
async function openClipVoting(episodeId, durationHours = 48) {
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    await prisma.episode.update({
        where: { id: episodeId },
        data: {
            status: 'clip_voting',
            // voting_ends_at: endsAt, // Add this field to Episode model if needed
        },
    });
    console.log(`[VotingPeriodManager] Clip voting opened for episode ${episodeId} until ${endsAt.toISOString()}`);
}
/**
 * Closes clip voting for episodes that have ended.
 */
async function closeExpiredClipVoting() {
    // Find episodes in clip_voting status that should be closed
    // This would need a voting_ends_at field on Episode
    const episodes = await prisma.episode.findMany({
        where: {
            status: 'clip_voting',
            // voting_ends_at: { lte: new Date() },
        },
    });
    let closedCount = 0;
    for (const episode of episodes) {
        try {
            await SeriesVotingService.closeClipVoting(episode.id);
            closedCount++;
        }
        catch (error) {
            console.error(`[VotingPeriodManager] Failed to close clip voting for episode ${episode.id}:`, error);
        }
    }
    return closedCount;
}
// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Calculates the next occurrence of a specific day/hour.
 */
function calculateNextStartTime(from, targetDayOfWeek, targetHour) {
    const result = new Date(from);
    // Set to target hour
    result.setUTCHours(targetHour, 0, 0, 0);
    // Calculate days until target day
    const currentDay = result.getUTCDay();
    let daysUntilTarget = targetDayOfWeek - currentDay;
    // If we're past the target time today, go to next week
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && from >= result)) {
        daysUntilTarget += 7;
    }
    result.setUTCDate(result.getUTCDate() + daysUntilTarget);
    return result;
}
/**
 * Gets voting period statistics for dashboard.
 */
async function getVotingDashboard() {
    const [currentPeriod, upcomingPeriod, completedPeriods] = await Promise.all([
        SeriesVotingService.getCurrentVotingPeriod('agent_voting'),
        SeriesVotingService.getNextVotingPeriod('agent_voting'),
        prisma.votingPeriod.findMany({
            where: { is_processed: true },
            orderBy: { ends_at: 'desc' },
            take: 10,
        }),
    ]);
    // Get recent winners (produced scripts)
    const recentWinners = await prisma.script.findMany({
        where: { pilot_status: 'produced' },
        orderBy: { produced_at: 'desc' },
        take: 5,
        select: {
            id: true,
            title: true,
            produced_at: true,
        },
    });
    // Calculate stats
    const totalVotes = await prisma.scriptVote.count();
    const totalScriptsVoted = await prisma.script.count({
        where: { pilot_status: { in: ['produced', 'rejected'] } },
    });
    return {
        currentPeriod,
        upcomingPeriod,
        recentWinners: recentWinners.map((s) => ({
            scriptId: s.id,
            title: s.title,
            closedAt: s.produced_at || new Date(),
        })),
        stats: {
            totalPeriodsCompleted: completedPeriods.length,
            totalScriptsVoted,
            averageVotesPerPeriod: completedPeriods.length > 0
                ? Math.round(totalVotes / completedPeriods.length)
                : 0,
        },
    };
}
//# sourceMappingURL=VotingPeriodManager.js.map
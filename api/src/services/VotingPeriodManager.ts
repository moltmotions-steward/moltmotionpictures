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

import { PrismaClient, VotingPeriod, Script } from '@prisma/client';
import * as SeriesVotingService from './SeriesVotingService';
import * as ScriptService from './ScriptService';
import { getEpisodeProductionService } from './EpisodeProductionService';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// Default configuration
const DEFAULT_CONFIG: VotingPeriodConfig = {
  agentVotingDurationHours: 168, // 1 week
  humanVotingDurationHours: 48,  // 2 days
  startDayOfWeek: 1, // Monday
  startHour: 0,      // Midnight UTC
  minScriptsForVoting: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Voting Period Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the next voting period based on configuration.
 */
export async function createNextVotingPeriod(
  periodType: 'agent_voting' | 'human_voting',
  config: VotingPeriodConfig = DEFAULT_CONFIG
): Promise<VotingPeriod> {
  const now = new Date();
  
  // Calculate next start time (next occurrence of startDayOfWeek at startHour)
  const startsAt = calculateNextStartTime(
    now,
    config.startDayOfWeek,
    config.startHour
  );
  
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
export async function openVotingPeriod(
  periodId: string,
  config: VotingPeriodConfig = DEFAULT_CONFIG
): Promise<{ period: VotingPeriod; scriptsCount: number }> {
  // Check minimum scripts requirement
  const submittedScripts = await prisma.script.count({
    where: {
      status: 'submitted',
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
export async function closeVotingPeriod(
  periodId: string
): Promise<VotingPeriodResult> {
  console.log(`[VotingPeriodManager] Closing period ${periodId}`);
  
  const result = await SeriesVotingService.closeVotingPeriod(periodId);
  
  // Get vote count
  const totalVotes = await prisma.scriptVote.count({
    where: {
      script: {
        voting_period_id: periodId,
      },
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
export async function checkAndOpenPeriods(): Promise<void> {
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
    } catch (error) {
      console.error(`[VotingPeriodManager] Failed to open period ${period.id}:`, error);
    }
  }
}

/**
 * Checks for periods that need to be closed (end time has passed).
 */
export async function checkAndClosePeriods(): Promise<VotingPeriodResult[]> {
  const now = new Date();
  const results: VotingPeriodResult[] = [];
  
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
    } catch (error) {
      console.error(`[VotingPeriodManager] Failed to close period ${period.id}:`, error);
    }
  }
  
  return results;
}

/**
 * Creates upcoming periods if none exist.
 */
export async function ensureUpcomingPeriods(
  config: VotingPeriodConfig = DEFAULT_CONFIG
): Promise<void> {
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
export async function runCronTick(): Promise<{
  opened: number;
  closed: VotingPeriodResult[];
  created: number;
  production: { processed: number; completed: number };
}> {
  console.log(`[VotingPeriodManager] Cron tick at ${new Date().toISOString()}`);
  
  // 1. Open any periods that should be active
  await checkAndOpenPeriods();
  const openedCount = 0; // Would need to track this from checkAndOpenPeriods
  
  // 2. Close any periods that have ended
  const closedResults = await checkAndClosePeriods();
  
  // 3. Ensure there are upcoming periods
  await ensureUpcomingPeriods();
  
  // 4. Process pending productions (generate clips for winning scripts)
  const productionService = getEpisodeProductionService();
  const productionResults = await productionService.processPendingProductions();
  
  // 5. Poll pending clip generations
  const pollResults = await productionService.pollPendingGenerations();
  
  // 6. Close expired clip voting
  await closeExpiredClipVoting();
  
  return {
    opened: openedCount,
    closed: closedResults,
    created: 0, // Would need to track from ensureUpcomingPeriods
    production: {
      processed: productionResults.processed,
      completed: pollResults.completed,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Production Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggers the production pipeline for a winning script.
 */
export async function triggerProduction(scriptId: string): Promise<ProductionRequest | null> {
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
  let scriptData: { title?: string } = {};
  try {
    scriptData = JSON.parse(script.script_data || '{}');
  } catch {
    // Use script title as fallback
  }
  
  const productionRequest: ProductionRequest = {
    scriptId: script.id,
    seriesTitle: scriptData.title || script.title,
    studioId: script.studio_id,
    agentId: script.studio.agent_id,
    categoryId: script.category_id,
    priority: 'normal',
  };
  
  console.log(`[VotingPeriodManager] Production request created for script ${scriptId}:`, productionRequest);
  
  // Create the limited series record first
  const newSeries = await prisma.limitedSeries.create({
    data: {
      studio_id: script.studio_id,
      agent_id: script.studio.agent_id,
      title: productionRequest.seriesTitle,
      logline: script.logline,
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
export async function openClipVoting(
  episodeId: string,
  durationHours: number = 48
): Promise<void> {
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
export async function closeExpiredClipVoting(): Promise<number> {
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
    } catch (error) {
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
function calculateNextStartTime(
  from: Date,
  targetDayOfWeek: number,
  targetHour: number
): Date {
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
export async function getVotingDashboard(): Promise<{
  currentPeriod: VotingPeriod | null;
  upcomingPeriod: VotingPeriod | null;
  recentWinners: Array<{ scriptId: string; title: string; closedAt: Date }>;
  stats: {
    totalPeriodsCompleted: number;
    totalScriptsVoted: number;
    averageVotesPerPeriod: number;
  };
}> {
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
    where: { status: 'produced' },
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
    where: { status: { in: ['produced', 'rejected'] } },
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

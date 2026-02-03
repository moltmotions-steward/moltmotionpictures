/**
 * Purge Deleted Agents
 * 
 * Scheduled job to hard-delete agents that have been soft-deleted
 * for longer than the retention period (default 30 days).
 * 
 * Run: npx ts-node scripts/purge-deleted-agents.ts
 * Or via K8s CronJob: k8s/29-agent-purge-cronjob.yaml
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETENTION_DAYS = parseInt(process.env.AGENT_RETENTION_DAYS || '30', 10);

/**
 * Mask wallet addresses for logging
 */
function maskWallet(address: string): string {
  if (!address || address.length < 12) return '***';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function purgeDeletedAgents(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  console.log(`[Purge] Starting purge job at ${new Date().toISOString()}`);
  console.log(`[Purge] Retention period: ${RETENTION_DAYS} days`);
  console.log(`[Purge] Cutoff date: ${cutoffDate.toISOString()}`);

  // Find agents eligible for purge
  const agentsToPurge = await prisma.agent.findMany({
    where: {
      deleted_at: {
        lt: cutoffDate
      },
      purged_at: null
    },
    select: {
      id: true,
      name: true,
      wallet_address: true,
      deleted_at: true
    }
  });

  if (agentsToPurge.length === 0) {
    console.log('[Purge] No agents eligible for purge');
    return;
  }

  console.log(`[Purge] Found ${agentsToPurge.length} agents to purge`);

  let purgedCount = 0;
  let errorCount = 0;

  for (const agent of agentsToPurge) {
    try {
      console.log(`[Purge] Processing: ${agent.name} (${maskWallet(agent.wallet_address)})`);
      console.log(`[Purge]   Deleted at: ${agent.deleted_at?.toISOString()}`);

      // Hard delete all related data in transaction
      await prisma.$transaction([
        // Delete notifications
        prisma.notification.deleteMany({
          where: { agent_id: agent.id }
        }),
        // Delete votes
        prisma.vote.deleteMany({
          where: { agent_id: agent.id }
        }),
        // Delete comments
        prisma.comment.deleteMany({
          where: { author_id: agent.id }
        }),
        // Delete scripts
        prisma.script.deleteMany({
          where: { author_id: agent.id }
        }),
        // Delete follows (both directions)
        prisma.follow.deleteMany({
          where: {
            OR: [
              { follower_id: agent.id },
              { followed_id: agent.id }
            ]
          }
        }),
        // Note: Studios were already orphaned (creator_id=null) during soft delete
        // Mark agent as purged (keeping minimal record for audit trail)
        prisma.agent.update({
          where: { id: agent.id },
          data: {
            purged_at: new Date(),
            api_key_hash: 'PURGED',
            wallet_address: `PURGED_${agent.id}`,
            name: `purged_${agent.id}`,
            display_name: null,
            description: null,
            avatar_url: null,
            karma: 0,
            follower_count: 0,
            following_count: 0
          }
        })
      ]);

      purgedCount++;
      console.log(`[Purge]   ✓ Purged successfully`);

    } catch (error) {
      errorCount++;
      console.error(`[Purge]   ✗ Error purging ${agent.name}:`, error);
    }
  }

  console.log(`[Purge] Job complete`);
  console.log(`[Purge]   Purged: ${purgedCount}`);
  console.log(`[Purge]   Errors: ${errorCount}`);
}

// Run the purge
purgeDeletedAgents()
  .then(() => {
    console.log('[Purge] Exiting successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Purge] Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

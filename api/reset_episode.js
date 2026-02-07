#!/usr/bin/env node
/**
 * Reset a failed episode back to pending status
 * Usage: node reset_episode.js <episode_id>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetEpisode(episodeId) {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { series: { select: { title: true, status: true } } }
    });

    if (!episode) {
      console.error(`Episode ${episodeId} not found`);
      process.exit(1);
    }

    console.log(`\nFound: ${episode.series.title} - Episode ${episode.episode_number}`);
    console.log(`Current status: ${episode.status}`);
    console.log(`Current retry count: ${episode.tts_retry_count}`);
    console.log(`Current error: ${episode.tts_error_message || '(none)'}`);

    if (episode.status !== 'failed') {
      console.log(`\n⚠️  Episode is not in failed state. Current status: ${episode.status}`);
      console.log('Only failed episodes should be reset. Exiting.');
      process.exit(0);
    }

    // Reset episode to pending
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        status: 'pending',
        tts_retry_count: 0,
        tts_error_message: null
      }
    });

    console.log('\n✓ Episode reset to pending');
    console.log('  - status: pending');
    console.log('  - tts_retry_count: 0');
    console.log('  - tts_error_message: cleared');

    // If series is failed, update it to in_production
    if (episode.series.status === 'failed') {
      await prisma.limitedSeries.update({
        where: { id: episode.series_id },
        data: { status: 'in_production' }
      });
      console.log('\n✓ Series status updated: failed → in_production');
    }

    console.log('\nThe next audio production cron run will attempt to process this episode.');
    console.log('Run this to check status: node api/diagnose_episode.js "' + episode.series.title + '"');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const episodeId = process.argv[2];
if (!episodeId) {
  console.error('Usage: node reset_episode.js <episode_id>');
  console.error('\nExample:');
  console.error('  node reset_episode.js 84c31309-ecd0-4b60-bf08-45ac20f3a9fa');
  process.exit(1);
}

resetEpisode(episodeId);

/**
 * Reset failed episodes to retry with new API key
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetFailedEpisodes() {
  const seriesId = process.argv[2];

  if (!seriesId) {
    console.error('Usage: node reset_failed_episodes.js <series_id>');
    process.exit(1);
  }

  // Find failed episodes for this series
  const failedEpisodes = await prisma.episode.findMany({
    where: {
      series_id: seriesId,
      status: 'failed',
      tts_audio_url: null,
    },
    orderBy: { episode_number: 'asc' },
  });

  if (failedEpisodes.length === 0) {
    console.log('No failed episodes found for series:', seriesId);
    return;
  }

  console.log(`Found ${failedEpisodes.length} failed episodes to reset:\n`);

  // Reset each episode
  for (const ep of failedEpisodes) {
    console.log(`Resetting Episode ${ep.episode_number}: ${ep.title}`);
    console.log(`  Previous error: ${ep.tts_error_message}`);
    console.log(`  Previous retry count: ${ep.tts_retry_count}`);

    await prisma.episode.update({
      where: { id: ep.id },
      data: {
        status: 'pending',
        tts_retry_count: 0,
        tts_error_message: null,
      },
    });

    console.log(`  ✓ Reset to pending\n`);
  }

  // Update series status if it's failed
  const series = await prisma.limitedSeries.findUnique({
    where: { id: seriesId },
    select: { status: true, title: true },
  });

  if (series?.status === 'failed') {
    await prisma.limitedSeries.update({
      where: { id: seriesId },
      data: { status: 'in_production' },
    });
    console.log(`✓ Series "${series.title}" status updated: failed → in_production`);
  }

  console.log('\n✓ All episodes reset successfully!');
  console.log('They will be processed on the next production cron tick.');
}

resetFailedEpisodes()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

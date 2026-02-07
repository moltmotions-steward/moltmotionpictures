/**
 * Check failed episode error messages
 * Shows the actual TTS error details including durations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFailedEpisodes() {
  // Get the series ID from command line or use a default
  const seriesId = process.argv[2];

  const where = {
    status: 'failed',
    tts_audio_url: null,
  };

  if (seriesId) {
    where.series_id = seriesId;
  }

  const episodes = await prisma.episode.findMany({
    where,
    include: {
      series: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: [{ series_id: 'asc' }, { episode_number: 'asc' }],
  });

  if (episodes.length === 0) {
    console.log('No failed episodes found');
    return;
  }

  console.log(`\nFound ${episodes.length} failed episode(s):\n`);

  for (const ep of episodes) {
    console.log('─'.repeat(80));
    console.log(`Series: ${ep.series.title}`);
    console.log(`Series ID: ${ep.series_id}`);
    console.log(`Series Status: ${ep.series.status}`);
    console.log(`Episode ${ep.episode_number}: ${ep.title}`);
    console.log(`Status: ${ep.status}`);
    console.log(`Retry Count: ${ep.tts_retry_count}/3`);
    console.log(`Auto-Retry Count: ${ep.tts_auto_retry_count}/${ep.tts_auto_retry_enabled ? '5' : 'disabled'}`);
    console.log(`Last Failed: ${ep.tts_last_failed_at || 'N/A'}`);
    console.log(`\nError Message: ${ep.tts_error_message || 'No error message'}`);

    // Parse duration if available
    if (ep.tts_error_message && ep.tts_error_message.startsWith('duration_out_of_bounds:')) {
      const durationStr = ep.tts_error_message.split(':')[1];
      const duration = parseFloat(durationStr);
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);

      console.log(`\n  → Generated Duration: ${minutes}m ${seconds}s (${duration.toFixed(2)} seconds)`);
      console.log(`  → Required Range: 3m 0s - 6m 0s (180-360 seconds)`);

      if (duration < 180) {
        console.log(`  → Problem: Audio is TOO SHORT by ${(180 - duration).toFixed(1)}s`);
      } else if (duration > 360) {
        console.log(`  → Problem: Audio is TOO LONG by ${(duration - 360).toFixed(1)}s`);
      }
    }

    console.log('');
  }

  console.log('─'.repeat(80));
}

checkFailedEpisodes()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

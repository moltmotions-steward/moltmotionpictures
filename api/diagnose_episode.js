#!/usr/bin/env node
/**
 * Diagnostic script to investigate failed episode
 * Usage: node diagnose_episode.js [series-title-fragment]
 * Example: node diagnose_episode.js "Quiet Planet"
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseEpisode(searchTitle) {
  try {
    // Find the series
    const series = await prisma.limitedSeries.findFirst({
      where: {
        title: { contains: searchTitle, mode: 'insensitive' }
      },
      include: {
        episodes: {
          orderBy: { episode_number: 'asc' }
        }
      }
    });

    if (!series) {
      console.error(`No series found matching "${searchTitle}"`);
      process.exit(1);
    }

    console.log(`\n=== Series: ${series.title} ===`);
    console.log(`ID: ${series.id}`);
    console.log(`Status: ${series.status}`);
    console.log(`Medium: ${series.medium}`);
    console.log(`Voice ID: ${series.narration_voice_id || '(none)'}`);
    console.log(`\n=== Episodes ===\n`);

    for (const ep of series.episodes) {
      const scriptLength = ep.audio_script_text?.length || 0;
      const hasScript = scriptLength > 0;

      console.log(`Episode ${ep.episode_number}: ${ep.title || '(untitled)'}`);
      console.log(`  ID: ${ep.id}`);
      console.log(`  Status: ${ep.status}`);
      console.log(`  Has audio: ${ep.tts_audio_url ? 'YES' : 'NO'}`);
      console.log(`  Script length: ${scriptLength} chars`);
      console.log(`  Retry count: ${ep.tts_retry_count}`);
      console.log(`  Auto-retry count: ${ep.tts_auto_retry_count}`);

      if (ep.tts_error_message) {
        console.log(`  ERROR: ${ep.tts_error_message}`);
      }

      if (ep.tts_last_failed_at) {
        console.log(`  Last failed: ${ep.tts_last_failed_at}`);
      }

      // Check for script issues
      if (!hasScript) {
        console.log(`  ⚠️  WARNING: No audio_script_text`);
      } else if (scriptLength < 100) {
        console.log(`  ⚠️  WARNING: Script very short (${scriptLength} chars)`);
      } else if (scriptLength > 50000) {
        console.log(`  ⚠️  WARNING: Script very long (${scriptLength} chars) - may exceed API limits`);
      }

      // Show first 200 chars of script for failed episodes
      if (ep.status === 'failed' && hasScript) {
        console.log(`  Script preview: "${ep.audio_script_text.substring(0, 200)}..."`);

        // Check for problematic characters
        const hasWeirdChars = /[^\x00-\x7F\u0080-\uFFFF]/.test(ep.audio_script_text);
        if (hasWeirdChars) {
          console.log(`  ⚠️  WARNING: Script contains unusual Unicode characters`);
        }
      }

      console.log('');
    }

    // Compare failed episode with successful ones
    const failed = series.episodes.filter(e => e.status === 'failed');
    const successful = series.episodes.filter(e => e.tts_audio_url);

    if (failed.length > 0 && successful.length > 0) {
      console.log('=== Comparison ===\n');

      const avgSuccessLength = successful.reduce((sum, e) => sum + (e.audio_script_text?.length || 0), 0) / successful.length;
      const failedLengths = failed.map(e => ({ num: e.episode_number, len: e.audio_script_text?.length || 0 }));

      console.log(`Average successful script length: ${Math.round(avgSuccessLength)} chars`);
      console.log('Failed episode lengths:');
      failedLengths.forEach(({ num, len }) => {
        const diff = len - avgSuccessLength;
        const pct = avgSuccessLength > 0 ? ((diff / avgSuccessLength) * 100).toFixed(1) : 'N/A';
        console.log(`  Episode ${num}: ${len} chars (${diff >= 0 ? '+' : ''}${diff}, ${pct}% difference)`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get search term from command line
const searchTerm = process.argv[2] || 'Quiet Planet';
diagnoseEpisode(searchTerm);

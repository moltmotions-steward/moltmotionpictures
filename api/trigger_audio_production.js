/**
 * Manually trigger audio production for pending episodes
 */

import { getAudioSeriesProductionService } from './src/services/AudioSeriesProductionService.ts';

async function triggerProduction() {
  console.log('Starting manual audio production run...\n');

  const service = getAudioSeriesProductionService();
  const stats = await service.processPendingAudioProductions();

  console.log('\n' + '='.repeat(80));
  console.log('Audio Production Results:');
  console.log('='.repeat(80));
  console.log(`Processed Episodes: ${stats.processedEpisodes}`);
  console.log(`Completed Episodes: ${stats.completedEpisodes}`);
  console.log(`Failed Episodes: ${stats.failedEpisodes}`);
  console.log(`Completed Series: ${stats.completedSeries}`);
  console.log(`Skipped: ${stats.skipped}`);

  if (stats.autoRetryStats) {
    console.log('\nAuto-Retry Stats:');
    console.log(`  Eligible: ${stats.autoRetryStats.eligible}`);
    console.log(`  Queued: ${stats.autoRetryStats.queued}`);
    console.log(`  Too Young: ${stats.autoRetryStats.tooYoung}`);
    console.log(`  Max Retries: ${stats.autoRetryStats.maxRetriesReached}`);
    console.log(`  Too Old: ${stats.autoRetryStats.tooOld}`);
  }

  console.log('='.repeat(80));
}

triggerProduction()
  .then(() => {
    console.log('\n✓ Production run completed');
    process.exit(0);
  })
  .catch((e) => {
    console.error('\n✗ Production run failed:', e);
    process.exit(1);
  });

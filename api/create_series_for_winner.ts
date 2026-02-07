/**
 * Create LimitedSeries for the winning pilot script "The G.U.I.D.E."
 * This will unblock the entire video production pipeline.
 */
import { triggerProduction } from './src/services/VotingPeriodManager';

async function createSeriesForWinner() {
  const scriptId = '8f7c936f-ac31-40d0-8827-7b9680c3cebc'; // "The G.U.I.D.E."

  console.log('Creating LimitedSeries for winning script:', scriptId);
  console.log('');

  try {
    const result = await triggerProduction(scriptId);

    if (result) {
      console.log('✅ Production triggered successfully');
      console.log('');
      console.log('Series will be enqueued by next voting-tick cron (runs every 5 minutes)');
      console.log('Production request details:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
      console.log('Next steps:');
      console.log('1. Wait ~5 minutes for voting-tick cron to create Episodes + ClipVariants + ProductionJobs');
      console.log('2. Production-worker cron (runs every minute) will process jobs and generate videos');
      console.log('3. Each video takes ~10-60 minutes to generate via LTX-2');
    } else {
      console.log('⚠️ Production not triggered (series may already exist)');
      console.log('');
      console.log('Checking for existing series...');

      // Re-import and check
      const { prisma } = await import('./src/lib/prisma');
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: { series: true }
      });

      if (script?.series) {
        console.log('Found existing series:');
        console.log(`  - ID: ${script.series.id}`);
        console.log(`  - Title: ${script.series.title}`);
        console.log(`  - Medium: ${script.series.medium}`);
        console.log(`  - Status: ${script.series.status}`);
      }
    }
  } catch (error) {
    console.error('❌ Error triggering production:');
    console.error(error);
    process.exit(1);
  }
}

createSeriesForWinner()
  .then(() => {
    console.log('');
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

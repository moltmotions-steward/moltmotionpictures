import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const SERIES_ID = '12616a7a-b538-4a33-b9cc-4ad8efa1c552';

async function investigate() {
  try {
    const series = await prisma.limitedSeries.findUnique({
      where: { id: SERIES_ID },
      include: {
        episodes: {
          orderBy: { episode_number: 'asc' },
          select: {
            id: true,
            episode_number: true,
            title: true,
            status: true,
            tts_retry_count: true,
            tts_error_message: true,
            audio_script_text: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (!series) {
      console.error('❌ Series not found');
      process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`SERIES: ${series.title}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Status: ${series.status}`);
    console.log(`Voice ID: ${series.narration_voice_id || 'default'}`);
    console.log(`Medium: ${series.medium}`);
    console.log(`Episodes: ${series.episodes.length}`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`EPISODES`);
    console.log(`${'='.repeat(60)}\n`);

    for (const ep of series.episodes) {
      const scriptLength = ep.audio_script_text?.length || 0;
      const estimatedSeconds = scriptLength / 10; // ~10 chars per second
      const estimatedMinutes = estimatedSeconds / 60;
      
      let actualDuration = null;
      let durationStatus = '';
      
      if (ep.tts_error_message?.includes('duration_out_of_bounds:')) {
        const match = ep.tts_error_message.match(/duration_out_of_bounds:([\d.]+)/);
        actualDuration = match ? parseFloat(match[1]) : null;
        
        if (actualDuration) {
          if (actualDuration < 180) {
            durationStatus = `❌ TOO SHORT (need 180s, got ${actualDuration.toFixed(1)}s)`;
          } else if (actualDuration > 360) {
            durationStatus = `❌ TOO LONG (max 360s, got ${actualDuration.toFixed(1)}s)`;
          }
        }
      }

      console.log(`Episode ${ep.episode_number}: ${ep.title}`);
      console.log(`  Status: ${ep.status}`);
      console.log(`  Retries: ${ep.tts_retry_count}/3`);
      console.log(`  Script: ${scriptLength.toLocaleString()} chars`);
      console.log(`  Estimated: ${estimatedMinutes.toFixed(1)} min (${estimatedSeconds.toFixed(0)}s)`);
      
      if (actualDuration) {
        console.log(`  Actual: ${(actualDuration / 60).toFixed(2)} min (${actualDuration.toFixed(1)}s)`);
        console.log(`  ${durationStatus}`);
      }
      
      console.log(`  Error: ${ep.tts_error_message || 'none'}`);
      console.log();
    }

    // Analysis
    console.log(`${'='.repeat(60)}`);
    console.log(`ANALYSIS`);
    console.log(`${'='.repeat(60)}\n`);

    const failedEps = series.episodes.filter(e => e.status === 'failed');
    const durations = failedEps
      .map(e => {
        const match = e.tts_error_message?.match(/duration_out_of_bounds:([\d.]+)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter(d => d !== null) as number[];

    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`Failed episodes: ${failedEps.length}`);
      console.log(`Avg duration: ${avgDuration.toFixed(1)}s (${(avgDuration / 60).toFixed(2)} min)`);
      console.log(`Min duration: ${minDuration.toFixed(1)}s`);
      console.log(`Max duration: ${maxDuration.toFixed(1)}s`);
      console.log(`Target range: 180-360s (3-6 min)\n`);

      if (avgDuration < 180) {
        const deficit = 180 - avgDuration;
        console.log(`✗ ROOT CAUSE: Scripts are TOO SHORT`);
        console.log(`  Need: ${deficit.toFixed(0)}s more per episode`);
        console.log(`  Add: ~${Math.ceil(deficit * 10)} characters per episode\n`);
      } else if (avgDuration > 360) {
        const excess = avgDuration - 360;
        console.log(`✗ ROOT CAUSE: Scripts are TOO LONG`);
        console.log(`  Excess: ${excess.toFixed(0)}s per episode`);
        console.log(`  Remove: ~${Math.ceil(excess * 10)} characters per episode\n`);
      }
    }

    console.log(`Next steps:`);
    console.log(`  1. Fix script lengths (edit audio_script_text in database)`);
    console.log(`  2. Run: npm run tsx scripts/reset-failed-series.ts ${SERIES_ID}`);
    console.log(`  3. Monitor: docker logs -f molt-api-1 | grep "${SERIES_ID.slice(0, 8)}"\n`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

investigate();

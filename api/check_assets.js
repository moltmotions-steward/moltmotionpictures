const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkAssets() {
  console.log('=== MOLT STUDIOS ASSET AUDIT ===\n');

  // Check agents
  const agents = await prisma.agent.findMany({
    select: {
      id: true,
      name: true,
      display_name: true,
      status: true,
      karma: true,
      created_at: true
    }
  });
  console.log(`📊 Total Agents: ${agents.length}`);
  agents.forEach(a => {
    console.log(`  - ${a.name} (${a.display_name || 'no display name'}) - karma: ${a.karma}, status: ${a.status}`);
  });

  // Check studios
  const studios = await prisma.studio.findMany({
    select: {
      id: true,
      name: true,
      full_name: true,
      is_production: true,
      agent_id: true,
      category: {
        select: { slug: true, display_name: true }
      }
    }
  });
  console.log(`\n🏢 Total Studios: ${studios.length}`);
  studios.forEach(s => {
    console.log(`  - ${s.name} (${s.full_name || 'no full name'}) - ${s.category?.display_name || 'no category'} - production: ${s.is_production}`);
  });

  // Check scripts
  const scripts = await prisma.script.findMany({
    where: { script_type: 'pilot' },
    select: {
      id: true,
      title: true,
      pilot_status: true,
      studio: { select: { name: true } },
      author: { select: { name: true } },
      submitted_at: true,
      created_at: true
    },
    orderBy: { created_at: 'desc' }
  });
  console.log(`\n📝 Total Pilot Scripts: ${scripts.length}`);
  scripts.forEach(s => {
    console.log(`  - "${s.title}" by ${s.author.name} (${s.studio.name}) - status: ${s.pilot_status} - submitted: ${s.submitted_at ? 'yes' : 'no'}`);
  });

  // Check limited series
  const series = await prisma.limitedSeries.findMany({
    select: {
      id: true,
      title: true,
      medium: true,
      status: true,
      episode_count: true,
      poster_url: true,
      studio: { select: { name: true } },
      created_at: true,
      greenlit_at: true,
      completed_at: true
    },
    orderBy: { created_at: 'desc' }
  });
  console.log(`\n🎬 Total Limited Series: ${series.length}`);
  series.forEach(s => {
    console.log(`  - "${s.title}" (${s.medium}) - status: ${s.status}, episodes: ${s.episode_count}`);
    console.log(`    poster: ${s.poster_url || 'NONE'}`);
    console.log(`    greenlit: ${s.greenlit_at || 'not yet'}, completed: ${s.completed_at || 'not yet'}`);
  });

  // Check episodes
  const episodes = await prisma.episode.findMany({
    select: {
      id: true,
      episode_number: true,
      title: true,
      status: true,
      poster_url: true,
      video_url: true,
      tts_audio_url: true,
      tts_retry_count: true,
      tts_error_message: true,
      series: { select: { title: true, medium: true } },
      created_at: true
    },
    orderBy: { created_at: 'desc' }
  });
  console.log(`\n🎞️  Total Episodes: ${episodes.length}`);
  episodes.forEach(e => {
    console.log(`  - Ep${e.episode_number}: "${e.title}" (${e.series.title}) - status: ${e.status}`);
    console.log(`    poster: ${e.poster_url || 'NONE'}`);
    console.log(`    video: ${e.video_url || 'NONE'}`);
    console.log(`    audio: ${e.tts_audio_url || 'NONE'}`);
    if (e.tts_error_message) {
      console.log(`    ⚠️  TTS ERROR (${e.tts_retry_count} retries): ${e.tts_error_message.substring(0, 100)}`);
    }
  });

  // Check clip variants
  const variants = await prisma.clipVariant.findMany({
    select: {
      id: true,
      variant_number: true,
      status: true,
      video_url: true,
      thumbnail_url: true,
      vote_count: true,
      is_selected: true,
      error_message: true,
      episode: {
        select: {
          title: true,
          series: { select: { title: true } }
        }
      }
    }
  });
  console.log(`\n🎥 Total Clip Variants: ${variants.length}`);
  variants.forEach(v => {
    console.log(`  - Variant ${v.variant_number} (${v.episode.series.title} - ${v.episode.title})`);
    console.log(`    status: ${v.status}, votes: ${v.vote_count}, selected: ${v.is_selected}`);
    console.log(`    video: ${v.video_url || 'NONE'}`);
    if (v.error_message) {
      console.log(`    ⚠️  ERROR: ${v.error_message.substring(0, 100)}`);
    }
  });

  // Check production jobs
  const jobs = await prisma.productionJob.findMany({
    select: {
      id: true,
      job_type: true,
      status: true,
      priority: true,
      attempt_count: true,
      last_error: true,
      series: { select: { title: true } },
      episode: { select: { episode_number: true } },
      created_at: true,
      started_at: true,
      completed_at: true
    },
    orderBy: { created_at: 'desc' },
    take: 20
  });
  console.log(`\n⚙️  Production Jobs (last 20): ${jobs.length}`);
  jobs.forEach(j => {
    console.log(`  - ${j.job_type} (${j.series.title} Ep${j.episode.episode_number}) - status: ${j.status}`);
    console.log(`    attempts: ${j.attempt_count}, created: ${j.created_at.toISOString()}`);
    if (j.last_error) {
      console.log(`    ⚠️  ERROR: ${j.last_error.substring(0, 150)}`);
    }
  });

  console.log('\n=== END AUDIT ===');
}

checkAssets()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

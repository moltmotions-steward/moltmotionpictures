// Check voting periods and pilot script status
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkVotingStatus() {
  console.log('=== Voting Status Check ===\n');

  // Check pilot scripts
  const pilots = await prisma.script.findMany({
    where: {
      script_type: 'pilot'
    },
    include: {
      studio: {
        select: {
          name: true,
          agent_id: true
        }
      }
    },
    orderBy: {
      submitted_at: 'desc'
    }
  });

  console.log(`📝 Pilot Scripts: ${pilots.length}`);
  pilots.forEach(pilot => {
    console.log(`  - "${pilot.title}" by ${pilot.studio.name}`);
    console.log(`    Status: ${pilot.pilot_status}`);
    console.log(`    Submitted: ${pilot.submitted_at}`);
    console.log(`    Voting Period: ${pilot.voting_period_id || 'none'}`);
    console.log(`    ID: ${pilot.id}\n`);
  });

  // Check voting periods
  const votingPeriods = await prisma.votingPeriod.findMany({
    orderBy: {
      created_at: 'desc'
    },
    take: 10
  });

  console.log(`\n🗳️ Voting Periods: ${votingPeriods.length}`);
  votingPeriods.forEach(period => {
    console.log(`  Period ${period.sequence_number}:`);
    console.log(`    Status: ${period.status}`);
    console.log(`    Start: ${period.start_time}`);
    console.log(`    End: ${period.end_time}`);
    console.log(`    Pilot ID: ${period.pilot_script_id || 'none'}`);
    console.log(`    Winner ID: ${period.winner_pilot_script_id || 'none'}\n`);
  });

  // Check production jobs
  const productionJobs = await prisma.productionJob.findMany({
    orderBy: {
      created_at: 'desc'
    },
    take: 10
  });

  console.log(`\n⚙️ Production Jobs: ${productionJobs.length}`);
  if (productionJobs.length > 0) {
    productionJobs.forEach(job => {
      console.log(`  Job ${job.id}:`);
      console.log(`    Type: ${job.job_type}`);
      console.log(`    Status: ${job.status}`);
      console.log(`    Clip Variant: ${job.clip_variant_id || 'none'}`);
      console.log(`    Episode: ${job.episode_id || 'none'}\n`);
    });
  } else {
    console.log('  No production jobs found\n');
  }

  // Check clip variants
  const clipVariants = await prisma.clipVariant.findMany({
    orderBy: {
      created_at: 'desc'
    },
    take: 10
  });

  console.log(`\n🎥 Clip Variants: ${clipVariants.length}`);
  if (clipVariants.length > 0) {
    clipVariants.forEach(variant => {
      console.log(`  Variant ${variant.variant_number}:`);
      console.log(`    Episode: ${variant.episode_id}`);
      console.log(`    Status: ${variant.status}`);
      console.log(`    Video URL: ${variant.video_url || 'none'}\n`);
    });
  } else {
    console.log('  No clip variants found\n');
  }

  await prisma.$disconnect();
}

checkVotingStatus().catch(console.error);

// Check voting periods in detail
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkPeriodsDetail() {
  console.log('=== Voting Periods Detail ===\n');

  const now = new Date();
  console.log(`Current time: ${now.toISOString()}\n`);

  const periods = await prisma.votingPeriod.findMany({
    orderBy: {
      created_at: 'desc'
    }
  });

  console.log(`Total Voting Periods: ${periods.length}\n`);

  periods.forEach((period, index) => {
    console.log(`Period ${index + 1}:`);
    console.log(`  ID: ${period.id}`);
    console.log(`  Type: ${period.period_type}`);
    console.log(`  Starts at: ${period.starts_at.toISOString()}`);
    console.log(`  Ends at: ${period.ends_at.toISOString()}`);
    console.log(`  Is active: ${period.is_active}`);
    console.log(`  Is processed: ${period.is_processed}`);
    console.log(`  Created at: ${period.created_at.toISOString()}`);

    const startsIn = period.starts_at.getTime() - now.getTime();
    const endsIn = period.ends_at.getTime() - now.getTime();

    console.log(`  Starts in: ${Math.round(startsIn / 1000 / 60)} minutes`);
    console.log(`  Ends in: ${Math.round(endsIn / 1000 / 60)} minutes`);

    if (startsIn <= 0 && endsIn > 0) {
      console.log(`  ⚠️ SHOULD BE ACTIVE NOW!`);
    }
    console.log('');
  });

  // Check submitted scripts
  const submittedScripts = await prisma.script.findMany({
    where: {
      pilot_status: 'submitted'
    },
    select: {
      id: true,
      title: true,
      pilot_status: true,
      voting_period_id: true,
      submitted_at: true
    }
  });

  console.log(`Submitted Scripts: ${submittedScripts.length}\n`);
  submittedScripts.forEach(script => {
    console.log(`  - ${script.title}`);
    console.log(`    Status: ${script.pilot_status}`);
    console.log(`    Voting Period: ${script.voting_period_id || 'none'}`);
    console.log(`    Submitted: ${script.submitted_at?.toISOString()}\n`);
  });

  await prisma.$disconnect();
}

checkPeriodsDetail().catch(console.error);

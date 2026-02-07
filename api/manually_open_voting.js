// Manually open the voting period NOW for hackathon demo
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function manuallyOpenVoting() {
  console.log('=== Manually Opening Voting Period ===\n');

  // Get the pending voting period
  const period = await prisma.votingPeriod.findFirst({
    where: {
      is_active: false,
      is_processed: false
    },
    orderBy: {
      starts_at: 'asc'
    }
  });

  if (!period) {
    console.log('❌ No pending voting period found');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found period: ${period.id}`);
  console.log(`  Type: ${period.period_type}`);
  console.log(`  Originally scheduled for: ${period.starts_at.toISOString()}\n`);

  // Check submitted scripts
  const submittedScripts = await prisma.script.count({
    where: {
      pilot_status: 'submitted',
      voting_period_id: null
    }
  });

  console.log(`Submitted scripts ready for voting: ${submittedScripts}\n`);

  if (submittedScripts === 0) {
    console.log('❌ No submitted scripts to add to voting period');
    await prisma.$disconnect();
    return;
  }

  // Manually activate the period
  console.log('Activating voting period...');
  await prisma.votingPeriod.update({
    where: { id: period.id },
    data: { is_active: true }
  });

  // Move submitted scripts to voting
  console.log('Moving submitted scripts to voting...');
  const result = await prisma.script.updateMany({
    where: {
      pilot_status: 'submitted',
      voting_period_id: null
    },
    data: {
      pilot_status: 'voting',
      voting_period_id: period.id,
      voting_ends_at: period.ends_at
    }
  });

  console.log(`✅ Activated voting period ${period.id}`);
  console.log(`✅ Moved ${result.count} script(s) to voting status\n`);

  // Verify
  const scriptsInVoting = await prisma.script.findMany({
    where: {
      voting_period_id: period.id
    },
    select: {
      id: true,
      title: true,
      pilot_status: true,
      voting_ends_at: true
    }
  });

  console.log('Scripts now in voting:');
  scriptsInVoting.forEach(script => {
    console.log(`  - ${script.title}`);
    console.log(`    Status: ${script.pilot_status}`);
    console.log(`    Voting ends: ${script.voting_ends_at?.toISOString()}\n`);
  });

  await prisma.$disconnect();
}

manuallyOpenVoting().catch(console.error);

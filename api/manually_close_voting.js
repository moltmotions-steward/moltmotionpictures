// Manually close the voting period and trigger production
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function manuallyCloseVoting() {
  console.log('=== Manually Closing Voting Period ===\n');

  // Get the active voting period
  const period = await prisma.votingPeriod.findFirst({
    where: {
      is_active: true,
      is_processed: false
    },
    orderBy: {
      starts_at: 'desc'
    }
  });

  if (!period) {
    console.log('❌ No active voting period found');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found active period: ${period.id}`);
  console.log(`  Type: ${period.period_type}`);
  console.log(`  Originally ends: ${period.ends_at.toISOString()}\n`);

  // Get scripts in this period, ordered by score
  const scripts = await prisma.script.findMany({
    where: {
      voting_period_id: period.id,
      pilot_status: 'voting'
    },
    include: {
      studio: true
    },
    orderBy: [
      { score: 'desc' },
      { upvotes: 'desc' },
      { submitted_at: 'asc' } // Tie-breaker
    ]
  });

  console.log(`Scripts in voting: ${scripts.length}\n`);
  scripts.forEach((script, index) => {
    console.log(`  ${index + 1}. ${script.title} by ${script.studio.name}`);
    console.log(`     Score: ${script.score}, Upvotes: ${script.upvotes}, Downvotes: ${script.downvotes}`);
  });
  console.log('');

  if (scripts.length === 0) {
    console.log('❌ No scripts in voting period');
    await prisma.$disconnect();
    return;
  }

  // Winner is the first one (highest score)
  const winner = scripts[0];
  console.log(`🏆 Winner: "${winner.title}" by ${winner.studio.name}\n`);

  // Mark period as processed
  console.log('Closing voting period...');
  await prisma.votingPeriod.update({
    where: { id: period.id },
    data: {
      is_active: false,
      is_processed: true
    }
  });

  // Update winner script to 'selected' status
  console.log('Marking winner as selected...');
  await prisma.script.update({
    where: { id: winner.id },
    data: {
      pilot_status: 'selected'
    }
  });

  // Update losing scripts to 'rejected' status
  const loserIds = scripts.slice(1).map(s => s.id);
  if (loserIds.length > 0) {
    console.log(`Marking ${loserIds.length} non-winning script(s) as rejected...`);
    await prisma.script.updateMany({
      where: {
        id: { in: loserIds }
      },
      data: {
        pilot_status: 'rejected'
      }
    });
  }

  console.log(`\n✅ Closed voting period ${period.id}`);
  console.log(`✅ Winner: ${winner.id} ("${winner.title}")\n`);
  console.log('⏳ Production pipeline will be triggered by the next cron tick...');
  console.log('   Or call VotingPeriodManager.triggerProduction() manually\n');

  await prisma.$disconnect();
}

manuallyCloseVoting().catch(console.error);

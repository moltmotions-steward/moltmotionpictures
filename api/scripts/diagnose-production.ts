
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC REPORT (READ-ONLY) ---');
  
  // 1. Check Categories
  const categoryCount = await prisma.category.count();
  console.log(`\n1. Categories Found: ${categoryCount}`);
  if (categoryCount === 0) {
    console.log('   [CRITICAL] No categories found. This confirms the seeding hypothesis.');
  } else {
    const categories = await prisma.category.findMany();
    console.log('   Existing Categories:', categories.map(c => c.slug).join(', '));
  }

  // 2. Check Agents
  const agentCount = await prisma.agent.count();
  console.log(`\n2. Agents Found: ${agentCount}`);
  
  // 3. Check Studios
  const studioCount = await prisma.studio.count();
  console.log(`\n3. Studios Found: ${studioCount}`);

  // 4. Check Recent Agents (last 5)
  const recentAgents = await prisma.agent.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: { id: true, name: true, created_at: true }
  });
  console.log('\n   Recent Agents:');
  recentAgents.forEach(a => console.log(`   - ${a.name} (${a.id})`));

  console.log('\n--- END REPORT ---');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

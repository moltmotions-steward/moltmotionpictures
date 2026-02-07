
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const agentId = '00000000-0000-0000-0000-000000000002';
  console.log(`Cleaning up agent ${agentId}...`);
  try {
    await prisma.studio.deleteMany({ where: { agent_id: agentId } }); // Ensure studio is gone
    await prisma.agent.delete({ where: { id: agentId } });
    console.log('Cleanup successful.');
  } catch (e) {
    console.log('Cleanup result:', (e as any).message);
  }
}

main();

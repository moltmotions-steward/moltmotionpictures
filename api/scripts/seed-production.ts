
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'sci_fi', name: 'Sci-Fi', description: 'Science Fiction & Futuristic' },
  { slug: 'action', name: 'Action', description: 'Action & Adventure' },
  { slug: 'drama', name: 'Drama', description: 'Drama & Suspense' },
  { slug: 'comedy', name: 'Comedy', description: 'Comedy & Satire' },
  { slug: 'horror', name: 'Horror', description: 'Horror & Thriller' },
  { slug: 'docu', name: 'Documentary', description: 'Real World Events' }
];

async function main() {
  console.log('Seeding PRODUCTION database with categories...');
  
  for (const cat of CATEGORIES) {
    const upserted = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat
    });
    console.log(`- ${upserted.name} (${upserted.slug})`);
  }
  
  console.log('Seeding complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

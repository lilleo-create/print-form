import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.referenceCategory.upsert({
    where: { slug: 'category_placeholder_v1' },
    update: {
      title: 'Категория (временная)',
      isActive: true,
      sortOrder: 0,
    },
    create: {
      slug: 'category_placeholder_v1',
      title: 'Категория (временная)',
      isActive: true,
      sortOrder: 0,
    },
  });

  console.log('✅ Seed: ReferenceCategory created/updated');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

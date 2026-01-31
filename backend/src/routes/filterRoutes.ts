import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /filters/reference-categories
router.get('/reference-categories', async (_req, res) => {
  const categories = await prisma.referenceCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, title: true },
  });

  res.json(categories);
});

export { router as filterRoutes };

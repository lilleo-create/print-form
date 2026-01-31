import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /filters/reference-categories
router.get('/reference-categories', async (_req, res) => {
  const categories = await prisma.referenceCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  res.json(categories);
});

export { router as filterRoutes };

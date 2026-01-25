import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const filterRoutes = Router();

filterRoutes.get('/', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany();
    const categories = Array.from(new Set(products.map((item) => item.category)));
    const materials = Array.from(new Set(products.map((item) => item.material)));
    const sizes = Array.from(new Set(products.map((item) => item.size)));
    const colors = Array.from(new Set(products.map((item) => item.color)));
    res.json({ data: { categories, materials, sizes, colors } });
  } catch (error) {
    next(error);
  }
});

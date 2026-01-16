import { Router } from 'express';
import { z } from 'zod';
import { productUseCases } from '../usecases/productUseCases';

export const productRoutes = Router();

productRoutes.get('/', async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category as string | undefined,
      material: req.query.material as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined
    };
    const products = await productUseCases.list(filters);
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

productRoutes.get('/:id', async (req, res, next) => {
  try {
    const product = await productUseCases.get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    return res.json({ data: product });
  } catch (error) {
    return next(error);
  }
});

export const sellerProductSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  price: z.number().min(1),
  image: z.string().url(),
  description: z.string().min(5),
  material: z.string().min(2),
  size: z.string().min(2),
  technology: z.string().min(2),
  printTime: z.string().min(2),
  color: z.string().min(2)
});

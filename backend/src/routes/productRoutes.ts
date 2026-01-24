import { Router } from 'express';
import { z } from 'zod';
import { productUseCases } from '../usecases/productUseCases';
import { reviewService } from '../services/reviewService';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

export const productRoutes = Router();

const listSchema = z.object({
  category: z.string().optional(),
  material: z.string().optional(),
  size: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.enum(['createdAt', 'rating']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional()
});

productRoutes.get('/', async (req, res, next) => {
  try {
    const params = listSchema.parse(req.query);
    const products = await productUseCases.list({
      category: params.category,
      material: params.material,
      size: params.size,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort: params.sort,
      order: params.order,
      page: params.page,
      limit: params.limit
    });
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

productRoutes.get('/:id', async (req, res, next) => {
  try {
    const product = await productUseCases.get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    const deliveryDateNearest = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    return res.json({ data: { ...product, deliveryDateNearest } });
  } catch (error) {
    return next(error);
  }
});

export const sellerProductSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  price: z.number().min(1),
  image: z.string().url().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  description: z.string().min(5),
  descriptionShort: z.string().min(5).optional(),
  descriptionFull: z.string().min(10).optional(),
  sku: z.string().min(3).optional(),
  currency: z.string().min(1).optional(),
  material: z.string().min(2),
  size: z.string().min(2),
  technology: z.string().min(2),
  printTime: z.string().min(2),
  color: z.string().min(2),
  deliveryDateEstimated: z.string().datetime().optional(),
  deliveryDates: z.array(z.string()).optional()
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  pros: z.string().min(3).max(500),
  cons: z.string().min(3).max(500),
  comment: z.string().min(10).max(1000),
  photos: z.array(z.string().url()).optional()
});

productRoutes.get('/:id/reviews', async (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const sort = req.query.sort ? String(req.query.sort) : 'new';
    const productIds = req.query.productIds
      ? String(req.query.productIds)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [req.params.id];
    const reviews = await reviewService.listByProducts(productIds, page, limit, sort);
    const total = await reviewService.countByProducts(productIds);
    res.json({ data: reviews, meta: { total } });
  } catch (error) {
    next(error);
  }
});

productRoutes.post('/:id/reviews', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const payload = reviewSchema.parse(req.body);
    const review = await reviewService.addReview({
      productId: req.params.id,
      userId: req.user!.userId,
      rating: payload.rating,
      pros: payload.pros,
      cons: payload.cons,
      comment: payload.comment,
      photos: payload.photos ?? []
    });
    res.status(201).json({ data: review });
  } catch (error) {
    next(error);
  }
});

productRoutes.get('/:id/reviews/summary', async (req, res, next) => {
  try {
    const productIds = req.query.productIds
      ? String(req.query.productIds)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [req.params.id];
    const summary = await reviewService.summaryByProducts(productIds);
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
});

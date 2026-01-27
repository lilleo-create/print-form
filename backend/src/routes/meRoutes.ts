import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';
import { reviewService } from '../services/reviewService';
import { writeLimiter } from '../middleware/rateLimiters';

export const meRoutes = Router();

meRoutes.get('/orders', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listByBuyer(req.user!.userId);
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

const reviewVisibilitySchema = z.object({
  isPublic: z.boolean()
});

meRoutes.get('/reviews', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const reviews = await reviewService.listByUser(req.user!.userId);
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
});

meRoutes.patch('/reviews/:id/visibility', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = reviewVisibilitySchema.parse(req.body);
    const updated = await reviewService.updateVisibility(req.params.id, req.user!.userId, payload.isPublic);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

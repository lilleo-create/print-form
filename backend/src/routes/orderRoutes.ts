import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';

export const orderRoutes = Router();

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().min(1)
      })
    )
    .min(1),
  total: z.number().min(1)
});

orderRoutes.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const payload = orderSchema.parse(req.body);
    const order = await orderUseCases.create({
      buyerId: req.user!.userId,
      total: payload.total,
      items: payload.items
    });
    res.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
});

orderRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listByBuyer(req.user!.userId);
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

orderRoutes.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await orderUseCases.get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    return res.json({ data: order });
  } catch (error) {
    return next(error);
  }
});

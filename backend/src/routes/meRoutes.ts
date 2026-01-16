import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';

export const meRoutes = Router();

meRoutes.get('/orders', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listByBuyer(req.user!.userId);
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

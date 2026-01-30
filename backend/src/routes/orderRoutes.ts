import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';

export const orderRoutes = Router();

const orderSchema = z.object({
  contactId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().min(1)
      })
    )
    .min(1)
});

orderRoutes.post('/', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = orderSchema.parse(req.body);
    if (payload.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: payload.contactId, userId: req.user!.userId }
      });
      if (!contact) {
        return res.status(404).json({ error: { code: 'CONTACT_NOT_FOUND' } });
      }
    }
    if (payload.shippingAddressId) {
      const address = await prisma.address.findFirst({
        where: { id: payload.shippingAddressId, userId: req.user!.userId }
      });
      if (!address) {
        return res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND' } });
      }
    }
    const order = await orderUseCases.create({
      buyerId: req.user!.userId,
      contactId: payload.contactId,
      shippingAddressId: payload.shippingAddressId,
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
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json({ data: order });
  } catch (error) {
    return next(error);
  }
});

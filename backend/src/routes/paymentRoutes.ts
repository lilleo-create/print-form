import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { writeLimiter } from '../middleware/rateLimiters';

export const paymentRoutes = Router();

const intentSchema = z.object({
  orderId: z.string(),
  provider: z.string().optional(),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(5).optional()
});

paymentRoutes.post('/intent', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = intentSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId }
    });
    if (!order || order.buyerId !== req.user!.userId) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }
    if (payload.amount !== order.total) {
      return res.status(400).json({ error: { code: 'AMOUNT_MISMATCH' } });
    }
    const payment = await prisma.payment.create({
      data: {
        orderId: payload.orderId,
        provider: payload.provider ?? 'manual',
        status: 'PENDING',
        amount: payload.amount,
        currency: payload.currency ?? order.currency,
        payloadJson: { source: 'api-intent' }
      }
    });
    res.status(201).json({
      data: {
        id: payment.id,
        status: payment.status,
        provider: payment.provider,
        amount: payment.amount,
        currency: payment.currency,
        clientSecret: payment.id
      }
    });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    if (!signature) {
      return res.status(400).json({ error: { code: 'SIGNATURE_REQUIRED' } });
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

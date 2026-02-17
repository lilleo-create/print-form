import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';
import { orderUseCases } from '../usecases/orderUseCases';

export const orderRoutes = Router();

const yaPvzSelectionSchema = z.object({
  provider: z.literal('YANDEX_NDD'),
  pvzId: z.string().min(1),
  addressFull: z.string().optional(),
  country: z.string().optional(),
  locality: z.string().optional(),
  street: z.string().optional(),
  house: z.string().optional(),
  comment: z.string().optional(),
  raw: z.unknown()
});

const createOrderSchema = z.object({
  buyerPickupPvz: yaPvzSelectionSchema,
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1)
});

orderRoutes.post('/', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = createOrderSchema.parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id: payload.items[0]?.productId },
      select: { sellerId: true }
    });

    if (!product) {
      return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND' } });
    }

    const sellerSettings = await prisma.sellerSettings.findUnique({ where: { sellerId: product.sellerId } });

    const order = await orderUseCases.create({
      buyerId: req.user!.userId,
      items: payload.items,
      buyerPickupPvz: {
        ...payload.buyerPickupPvz,
        raw: payload.buyerPickupPvz.raw ?? {}
      },
      sellerDropoffPvz: sellerSettings?.defaultDropoffPvzId
        ? {
            provider: 'YANDEX_NDD',
            pvzId: sellerSettings.defaultDropoffPvzId,
            raw: sellerSettings.defaultDropoffPvzMeta ?? {},
            addressFull: typeof sellerSettings.defaultDropoffPvzMeta === 'object' && sellerSettings.defaultDropoffPvzMeta
              ? String((sellerSettings.defaultDropoffPvzMeta as Record<string, unknown>).addressFull ?? '')
              : undefined
          }
        : undefined
    });

    return res.status(201).json({ data: order, orderId: order.id });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.post('/:id/pay', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({ where: { id: req.params.id, buyerId: req.user!.userId } });
    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }
    return res.status(409).json({ error: { code: 'PAYMENT_FLOW_CHANGED', message: 'Use POST /payments/start for payment flow' } });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.post('/:id/ready-for-shipment', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        status: 'PAID',
        items: { some: { product: { sellerId: req.user!.userId } } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'READY_FOR_SHIPMENT',
        readyForShipmentAt: now,
        dropoffDeadlineAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    return res.json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: req.user!.userId },
      include: { items: { include: { product: true, variant: true } }, deliveryEvents: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

orderRoutes.get('/:id/delivery/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        OR: [{ buyerId: req.user!.userId }, { items: { some: { product: { sellerId: req.user!.userId } } } }]
      },
      include: { deliveryEvents: { orderBy: { createdAt: 'desc' } } }
    });
    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json({ data: order.deliveryEvents });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        OR: [{ buyerId: req.user!.userId }, { items: { some: { product: { sellerId: req.user!.userId } } } }]
      },
      include: {
        items: { include: { product: true, variant: true } },
        contact: true,
        shippingAddress: true,
        buyer: true,
        deliveryEvents: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json({ data: order });
  } catch (error) {
    return next(error);
  }
});

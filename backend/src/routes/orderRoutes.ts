import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';
import { orderDeliveryService, type OrderDeliveryData } from '../services/orderDeliveryService';

export const orderRoutes = Router();

const legacyOrderSchema = z.object({
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

const checkoutOrderSchema = z.object({
  delivery: z.object({
    deliveryProvider: z.string(),
    deliveryMethod: z.enum(['COURIER', 'PICKUP_POINT']),
    courierAddress: z
      .object({
        line1: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        apartment: z.string().nullable().optional(),
        floor: z.string().nullable().optional(),
        comment: z.string().nullable().optional()
      })
      .optional(),
    pickupPoint: z
      .object({
        id: z.string(),
        fullAddress: z.string(),
        country: z.string().optional(),
        locality: z.string().optional(),
        street: z.string().optional(),
        house: z.string().optional(),
        comment: z.string().optional(),
        position: z.record(z.unknown()).optional(),
        type: z.string().optional(),
        paymentMethods: z.array(z.string()).optional()
      })
      .optional(),
    deliveryMeta: z.record(z.unknown()).optional()
  }),
  recipient: z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string().email()
  }),
  payment: z.object({
    method: z.enum(['CARD', 'SBP']),
    cardId: z.string().optional()
  }),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().min(1),
        variantId: z.string().optional()
      })
    )
    .min(1)
});

const attachDeliveryData = async <T extends { id: string }>(orders: T[]) => {
  const map = await orderDeliveryService.getByOrderIds(orders.map((order) => order.id));
  return orders.map((order) => ({
    ...order,
    delivery: map.get(order.id) ?? null
  }));
};

orderRoutes.post('/', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const parsedLegacy = legacyOrderSchema.safeParse(req.body);
    const payload = parsedLegacy.success
      ? parsedLegacy.data
      : checkoutOrderSchema.parse(req.body);

    if ('recipient' in payload) {
      const existingContact = await prisma.contact.findFirst({ where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
      if (existingContact) {
        await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            name: payload.recipient.name,
            phone: payload.recipient.phone,
            email: payload.recipient.email
          }
        });
      } else {
        await prisma.contact.create({
          data: {
            userId: req.user!.userId,
            name: payload.recipient.name,
            phone: payload.recipient.phone,
            email: payload.recipient.email
          }
        });
      }
    }

    if ('contactId' in payload && payload.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: payload.contactId, userId: req.user!.userId }
      });
      if (!contact) {
        return res.status(404).json({ error: { code: 'CONTACT_NOT_FOUND' } });
      }
    }

    if ('shippingAddressId' in payload && payload.shippingAddressId) {
      const address = await prisma.address.findFirst({
        where: { id: payload.shippingAddressId, userId: req.user!.userId }
      });
      if (!address) {
        return res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND' } });
      }
    }

    const order = await orderUseCases.create({
      buyerId: req.user!.userId,
      contactId: 'contactId' in payload ? payload.contactId : undefined,
      shippingAddressId: 'shippingAddressId' in payload ? payload.shippingAddressId : undefined,
      items: payload.items
    });

    if ('delivery' in payload) {
      const deliveryPayload: OrderDeliveryData = {
        deliveryProvider: payload.delivery.deliveryProvider,
        deliveryMethod: payload.delivery.deliveryMethod,
        courierAddress: payload.delivery.deliveryMethod === 'COURIER' ? payload.delivery.courierAddress ?? null : null,
        pickupPoint: payload.delivery.deliveryMethod === 'PICKUP_POINT' ? payload.delivery.pickupPoint ?? null : null,
        deliveryMeta: payload.delivery.deliveryMeta ?? {}
      };
      await orderDeliveryService.upsert(order.id, deliveryPayload);
    }

    return res.status(201).json({ data: order, orderId: order.id });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listByBuyer(req.user!.userId);
    const enriched = await attachDeliveryData(orders);
    res.json({ data: enriched });
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
    const [enriched] = await attachDeliveryData([order]);
    return res.json({ data: enriched });
  } catch (error) {
    return next(error);
  }
});

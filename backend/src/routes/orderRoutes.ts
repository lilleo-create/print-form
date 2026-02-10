import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';

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
    method: z.enum(['ADDRESS', 'PICKUP']),
    address: z
      .object({
        line1: z.string(),
        city: z.string(),
        postalCode: z.string(),
        country: z.string()
      })
      .partial()
      .optional(),
    pickupPointId: z.string().optional(),
    provider: z.enum(['CDEK', 'YANDEX']).optional()
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

    return res.status(201).json({ data: order, orderId: order.id });
  } catch (error) {
    return next(error);
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

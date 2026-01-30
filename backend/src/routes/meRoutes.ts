import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { orderUseCases } from '../usecases/orderUseCases';
import { reviewService } from '../services/reviewService';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';

export const meRoutes = Router();

const addressSchema = z.object({
  addressText: z.string().min(3),
  apartment: z.string().optional(),
  floor: z.string().optional(),
  label: z.string().optional(),
  isFavorite: z.boolean().optional(),
  courierComment: z.string().optional(),
  coords: z
    .object({
      lat: z.number(),
      lon: z.number()
    })
    .nullable()
    .optional()
});

const contactSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional()
});

meRoutes.get('/addresses', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: addresses });
  } catch (error) {
    next(error);
  }
});

meRoutes.get('/addresses/default', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const address = await prisma.address.findFirst({
      where: { userId: req.user!.userId, isDefault: true }
    });
    res.json({ data: address ?? null });
  } catch (error) {
    next(error);
  }
});

meRoutes.post('/addresses', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = addressSchema.parse(req.body);
    const existingDefault = await prisma.address.findFirst({
      where: { userId: req.user!.userId, isDefault: true }
    });
    const created = await prisma.address.create({
      data: {
        userId: req.user!.userId,
        addressText: payload.addressText,
        apartment: payload.apartment,
        floor: payload.floor,
        label: payload.label,
        isFavorite: payload.isFavorite ?? false,
        courierComment: payload.courierComment,
        coords: payload.coords ?? undefined,
        isDefault: existingDefault ? false : true
      }
    });
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

meRoutes.patch('/addresses/:id', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = addressSchema.partial().parse(req.body);
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.userId }
    });
    if (!existing) {
      return res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND' } });
    }
    const updated = await prisma.address.update({
      where: { id: req.params.id },
      data: {
        addressText: payload.addressText ?? existing.addressText,
        apartment: payload.apartment ?? existing.apartment,
        floor: payload.floor ?? existing.floor,
        label: payload.label ?? existing.label,
        isFavorite: payload.isFavorite ?? existing.isFavorite,
        courierComment: payload.courierComment ?? existing.courierComment,
        coords: payload.coords ?? existing.coords ?? undefined
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

meRoutes.delete('/addresses/:id', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.userId }
    });
    if (!existing) {
      return res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND' } });
    }
    await prisma.address.delete({ where: { id: req.params.id } });
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' }
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

meRoutes.post('/addresses/:id/default', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const address = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.userId }
    });
    if (!address) {
      return res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND' } });
    }
    await prisma.address.updateMany({
      where: { userId: req.user!.userId, isDefault: true },
      data: { isDefault: false }
    });
    const updated = await prisma.address.update({
      where: { id: req.params.id },
      data: { isDefault: true }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

meRoutes.get('/contacts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: contacts });
  } catch (error) {
    next(error);
  }
});

meRoutes.post('/contacts', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = contactSchema.parse(req.body);
    const created = await prisma.contact.create({
      data: {
        userId: req.user!.userId,
        name: payload.name,
        phone: payload.phone,
        email: payload.email
      }
    });
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

meRoutes.patch('/contacts/:id', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = contactSchema.partial().parse(req.body);
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, userId: req.user!.userId }
    });
    if (!existing) {
      return res.status(404).json({ error: { code: 'CONTACT_NOT_FOUND' } });
    }
    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: payload.name ?? existing.name,
        phone: payload.phone ?? existing.phone,
        email: payload.email ?? existing.email
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

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

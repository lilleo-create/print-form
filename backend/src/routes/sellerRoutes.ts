import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { productUseCases } from '../usecases/productUseCases';
import { orderUseCases } from '../usecases/orderUseCases';
import { sellerProductSchema } from './productRoutes';

export const sellerRoutes = Router();

const sellerOnboardingSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  status: z.enum(['ИП', 'ООО', 'Самозанятый']),
  storeName: z.string().min(2),
  city: z.string().min(2),
  referenceCategory: z.string().min(2),
  catalogPosition: z.string().min(2)
});

sellerRoutes.post('/onboarding', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerOnboardingSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        name: payload.name,
        phone: payload.phone,
        role: 'SELLER',
        sellerProfile: {
          upsert: {
            create: {
              status: payload.status,
              storeName: payload.storeName,
              city: payload.city,
              referenceCategory: payload.referenceCategory,
              catalogPosition: payload.catalogPosition
            },
            update: {
              status: payload.status,
              storeName: payload.storeName,
              city: payload.city,
              referenceCategory: payload.referenceCategory,
              catalogPosition: payload.catalogPosition
            }
          }
        }
      }
    });
    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role
      }
    });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.use(authenticate, authorize(['SELLER', 'ADMIN']));

sellerRoutes.get('/products', async (req: AuthRequest, res, next) => {
  try {
    const products = await productUseCases.list({});
    const sellerProducts = products.filter((product) => product.sellerId === req.user?.userId);
    res.json({ data: sellerProducts });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/products', async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerProductSchema.parse(req.body);
    const skuFallback = payload.sku ?? `SKU-${Date.now()}`;
    const product = await productUseCases.create({
      ...payload,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: skuFallback,
      currency: payload.currency ?? 'RUB',
      sellerId: req.user!.userId
    });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.put('/products/:id', async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerProductSchema.partial().parse(req.body);
    const product = await productUseCases.update(req.params.id, {
      ...payload,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: payload.sku,
      currency: payload.currency,
      sellerId: req.user!.userId
    });
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.delete('/products/:id', async (req: AuthRequest, res, next) => {
  try {
    await productUseCases.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/orders', async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listBySeller(req.user!.userId);
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listBySeller(req.user!.userId);
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    res.json({ data: { revenue, orders: orders.length } });
  } catch (error) {
    next(error);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { authenticate, authorize, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { productUseCases } from '../usecases/productUseCases';
import { orderUseCases } from '../usecases/orderUseCases';
import { sellerProductSchema } from './productRoutes';

export const sellerRoutes = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

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
              phone: payload.phone,
              city: payload.city,
              referenceCategory: payload.referenceCategory,
              catalogPosition: payload.catalogPosition
            },
            update: {
              status: payload.status,
              storeName: payload.storeName,
              phone: payload.phone,
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

sellerRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { sellerProfile: true }
    });
    res.json({
      data: {
        isSeller: user?.role === 'SELLER' && Boolean(user.sellerProfile),
        profile: user?.sellerProfile ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.use(authenticate, authorize(['SELLER', 'ADMIN']));

sellerRoutes.get('/products', async (req: AuthRequest, res, next) => {
  try {
    const sellerProducts = await prisma.product.findMany({
      where: { sellerId: req.user!.userId },
      include: { images: { orderBy: { sortOrder: 'asc' } } }
    });
    res.json({ data: sellerProducts });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/products', async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerProductSchema.parse(req.body);
    const skuFallback = payload.sku ?? `SKU-${Date.now()}`;
    if (!payload.imageUrls?.length && !payload.image) {
      return res.status(400).json({ error: { code: 'IMAGE_REQUIRED' } });
    }
    const imageUrls = payload.imageUrls?.length ? payload.imageUrls : [payload.image ?? ''];
    const product = await productUseCases.create({
      ...payload,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: skuFallback,
      currency: payload.currency ?? 'RUB',
      sellerId: req.user!.userId,
      image: imageUrls[0],
      imageUrls,
      deliveryDateEstimated: payload.deliveryDateEstimated ? new Date(payload.deliveryDateEstimated) : undefined,
      deliveryDates: payload.deliveryDates ?? []
    });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.put('/products/:id', async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerProductSchema.partial().parse(req.body);
    const imageUrls = payload.imageUrls ?? (payload.image ? [payload.image] : undefined);
    const product = await productUseCases.update(req.params.id, {
      ...payload,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: payload.sku,
      currency: payload.currency,
      sellerId: req.user!.userId,
      image: imageUrls?.[0] ?? payload.image,
      imageUrls,
      deliveryDateEstimated: payload.deliveryDateEstimated ? new Date(payload.deliveryDateEstimated) : undefined,
      deliveryDates: payload.deliveryDates ?? undefined
    });
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/uploads', upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.json({ data: { urls } });
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
    const products = await prisma.product.findMany({ where: { sellerId: req.user!.userId } });
    const averageRating =
      products.reduce((sum, product) => sum + product.ratingAvg, 0) / Math.max(products.length, 1);
    res.json({
      data: {
        totalOrders: orders.length,
        totalRevenue: revenue,
        totalProducts: products.length,
        averageRating
      }
    });
  } catch (error) {
    next(error);
  }
});

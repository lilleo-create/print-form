import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, authorize, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { productUseCases } from '../usecases/productUseCases';
import { orderUseCases } from '../usecases/orderUseCases';
import { sellerProductSchema } from './productRoutes';
import { writeLimiter } from '../middleware/rateLimiters';

export const sellerRoutes = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
const kycUploadDir = path.join(uploadDir, 'kyc');
if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});
const kycStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, kycUploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('KYC_FILE_TYPE_INVALID'));
    }
    return cb(null, true);
  }
});

const sellerOnboardingSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  status: z.enum(['ИП', 'ООО', 'Самозанятый']),
  storeName: z.string().min(2),
  city: z.string().min(2),
  referenceCategory: z.string().min(2),
  catalogPosition: z.string().min(2)
});

sellerRoutes.post('/onboarding', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerOnboardingSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { phoneVerifiedAt: true, phone: true }
    });
    if (!user?.phoneVerifiedAt) {
      return res.status(403).json({ error: { code: 'PHONE_NOT_VERIFIED' } });
    }
    const phone = user.phone ?? payload.phone;
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        name: payload.name,
        phone,
        role: 'SELLER',
        sellerProfile: {
          upsert: {
            create: {
              status: payload.status,
              storeName: payload.storeName,
              phone,
              city: payload.city,
              referenceCategory: payload.referenceCategory,
              catalogPosition: payload.catalogPosition
            },
            update: {
              status: payload.status,
              storeName: payload.storeName,
              phone,
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
    const latestSubmission = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { documents: true }
    });
    const approvedSubmission = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId, status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' }
    });
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { sellerProfile: true }
    });
    res.json({
      data: {
        isSeller: user?.role === 'SELLER' && Boolean(user.sellerProfile),
        profile: user?.sellerProfile ?? null,
        kyc: latestSubmission,
        canSell: Boolean(approvedSubmission)
      }
    });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.use(authenticate, authorize(['SELLER', 'ADMIN']));

const ensureKycApproved = async (userId: string) => {
  const approved = await prisma.sellerKycSubmission.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' }
  });
  return Boolean(approved);
};

sellerRoutes.get('/kyc/me', async (req: AuthRequest, res, next) => {
  try {
    const submission = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { documents: true }
    });
    res.json({ data: submission ?? null });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/kyc/submit', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const latest = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    if (latest && latest.status === 'PENDING') {
      return res.json({ data: latest });
    }
    const created = await prisma.sellerKycSubmission.create({
      data: {
        userId: req.user!.userId,
        status: 'PENDING',
        submittedAt: new Date()
      },
      include: { documents: true }
    });
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/kyc/documents', writeLimiter, kycUpload.array('files', 5), async (req: AuthRequest, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) {
      return res.status(400).json({ error: { code: 'KYC_FILES_REQUIRED' } });
    }
    let submission = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    if (!submission || submission.status === 'REJECTED') {
      submission = await prisma.sellerKycSubmission.create({
        data: {
          userId: req.user!.userId,
          status: 'PENDING',
          submittedAt: new Date()
        }
      });
    }
    const createdDocs = await prisma.$transaction(
      files.map((file) =>
        prisma.sellerDocument.create({
          data: {
            submissionId: submission!.id,
            type: 'document',
            url: `/uploads/kyc/${file.filename}`,
            originalName: file.originalname,
            mime: file.mimetype,
            size: file.size
          }
        })
      )
    );
    res.status(201).json({ data: { submissionId: submission.id, documents: createdDocs } });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/products', async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED' } });
    }
    const sellerProducts = await prisma.product.findMany({
      where: { sellerId: req.user!.userId },
      include: { images: { orderBy: { sortOrder: 'asc' } } }
    });
    res.json({ data: sellerProducts });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/products', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED' } });
    }
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

sellerRoutes.put('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED' } });
    }
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

sellerRoutes.post('/uploads', writeLimiter, upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.json({ data: { urls } });
});

sellerRoutes.delete('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED' } });
    }
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

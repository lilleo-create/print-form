import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireSeller, AuthRequest } from '../middleware/authMiddleware';
import { OrderStatus } from '@prisma/client';
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
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const allowedVideoTypes = ['video/mp4', 'video/webm'];
const maxImageSize = 10 * 1024 * 1024;
const maxVideoSize = 100 * 1024 * 1024;
const upload = multer({
  storage,
  limits: {
    fileSize: maxVideoSize
  },
  fileFilter: (_req, file, cb) => {
    if ([...allowedImageTypes, ...allowedVideoTypes].includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('UPLOAD_FILE_TYPE_INVALID'));
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

sellerRoutes.post('/onboarding', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
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

const loadSellerContext = async (userId: string) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId }
  });
  if (!profile) {
    return {
      isSeller: false,
      profile: null,
      kyc: null,
      canSell: false
    };
  }
  const latestSubmission = await prisma.sellerKycSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { documents: true }
  });
  const approvedSubmission = await prisma.sellerKycSubmission.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' }
  });
  return {
    isSeller: true,
    profile,
    kyc: latestSubmission ?? null,
    canSell: Boolean(approvedSubmission)
  };
};

sellerRoutes.get('/context', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const context = await loadSellerContext(req.user!.userId);
    res.json({ data: context });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const context = await loadSellerContext(req.user!.userId);
    res.json({ data: context });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.use(requireAuth, requireSeller);

const orderStatusFlow: OrderStatus[] = [
  'CREATED',
  'PRINTING',
  'HANDED_TO_DELIVERY',
  'IN_TRANSIT',
  'DELIVERED'
];

const ensureKycApproved = async (userId: string) => {
  const approved = await prisma.sellerKycSubmission.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' }
  });
  return Boolean(approved);
};

const ensureReferenceCategory = async (category: string) => {
  const ref = await prisma.referenceCategory.findFirst({
    where: {
      isActive: true,
      OR: [{ title: category }, { slug: category }]
    }
  });
  if (!ref) {
    throw new Error('CATEGORY_INVALID');
  }
  return ref.title;
};

const validateDeliveryDate = (value?: string) => {
  if (!value) return;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('DELIVERY_DATE_INVALID');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(parsed);
  candidate.setHours(0, 0, 0, 0);
  if (candidate < today) {
    throw new Error('DELIVERY_DATE_TOO_EARLY');
  }
  if (candidate.getFullYear() > today.getFullYear()) {
    throw new Error('DELIVERY_DATE_YEAR_INVALID');
  }
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
            fileName: file.filename,
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
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
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
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    const payload = sellerProductSchema.parse(req.body);
    const normalizedCategory = await ensureReferenceCategory(payload.category);
    validateDeliveryDate(payload.deliveryDateEstimated);
    const skuFallback = payload.sku ?? `SKU-${Date.now()}`;
    if (!payload.imageUrls?.length && !payload.image) {
      return res.status(400).json({ error: { code: 'IMAGE_REQUIRED' } });
    }
    const providedImageUrls = payload.imageUrls ?? [];
    const imageUrls = providedImageUrls.length ? providedImageUrls : payload.image ? [payload.image] : [];
    const videoUrls = payload.videoUrls ?? [];
    const product = await productUseCases.create({
      ...payload,
      category: normalizedCategory,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: skuFallback,
      currency: payload.currency ?? 'RUB',
      sellerId: req.user!.userId,
      image: imageUrls[0],
      imageUrls,
      videoUrls,
      deliveryDateEstimated: payload.deliveryDateEstimated ? new Date(payload.deliveryDateEstimated) : undefined,
    });
    res.status(201).json({ data: product });
  } catch (error) {
    if (error instanceof Error && error.message === 'CATEGORY_INVALID') {
      return res.status(400).json({ error: { code: 'CATEGORY_INVALID', message: 'Категория недоступна.' } });
    }
    if (error instanceof Error && error.message.startsWith('DELIVERY_DATE_')) {
      return res.status(400).json({ error: { code: error.message, message: 'Некорректная дата доставки.' } });
    }
    next(error);
  }
});

sellerRoutes.put('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    const payload = sellerProductSchema.partial().parse(req.body);
    const normalizedCategory = payload.category ? await ensureReferenceCategory(payload.category) : undefined;
    if (payload.deliveryDateEstimated) {
      validateDeliveryDate(payload.deliveryDateEstimated);
    }
    const imageUrls = payload.imageUrls ?? (payload.image ? [payload.image] : undefined);
    const videoUrls = payload.videoUrls;
    const product = await productUseCases.update(req.params.id, {
      ...payload,
      category: normalizedCategory ?? payload.category,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: payload.sku,
      currency: payload.currency,
      sellerId: req.user!.userId,
      image: imageUrls?.[0] ?? payload.image,
      imageUrls,
      videoUrls,
      deliveryDateEstimated: payload.deliveryDateEstimated ? new Date(payload.deliveryDateEstimated) : undefined,
    });
    res.json({ data: product });
  } catch (error) {
    if (error instanceof Error && error.message === 'CATEGORY_INVALID') {
      return res.status(400).json({ error: { code: 'CATEGORY_INVALID', message: 'Категория недоступна.' } });
    }
    if (error instanceof Error && error.message.startsWith('DELIVERY_DATE_')) {
      return res.status(400).json({ error: { code: error.message, message: 'Некорректная дата доставки.' } });
    }
    next(error);
  }
});

sellerRoutes.post('/uploads', writeLimiter, upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) {
    return res.status(400).json({ error: { code: 'FILES_REQUIRED' } });
  }
  const oversizedFiles = files.filter((file) => {
    if (allowedImageTypes.includes(file.mimetype)) {
      return file.size > maxImageSize;
    }
    if (allowedVideoTypes.includes(file.mimetype)) {
      return file.size > maxVideoSize;
    }
    return true;
  });
  if (oversizedFiles.length) {
    await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
    return res.status(400).json({ error: { code: 'FILE_TOO_LARGE' } });
  }
  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.json({ data: { urls } });
});

sellerRoutes.delete('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    await productUseCases.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const sellerOrdersQuerySchema = z.object({
  status: z
    .enum(['CREATED', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'])
    .optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const sellerOrderStatusSchema = z.object({
  status: z.enum(['CREATED', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED']),
  trackingNumber: z.string().min(2).optional(),
  carrier: z.string().min(2).optional()
});

sellerRoutes.get('/orders', async (req: AuthRequest, res, next) => {
  try {
    const query = sellerOrdersQuerySchema.parse(req.query);
    const orders = await orderUseCases.listBySeller(req.user!.userId, {
      status: query.status as OrderStatus | undefined,
      offset: query.offset,
      limit: query.limit
    });
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/payments', async (req: AuthRequest, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        order: {
          items: { some: { product: { sellerId: req.user!.userId } } }
        }
      },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        currency: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.patch('/orders/:id/status', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerOrderStatusSchema.parse(req.body);
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        items: { some: { product: { sellerId: req.user!.userId } } }
      },
      include: {
        items: {
          where: { product: { sellerId: req.user!.userId } },
          include: { product: true, variant: true }
        },
        contact: true,
        shippingAddress: true,
        buyer: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }

    const currentIndex = orderStatusFlow.indexOf(order.status);
    const nextIndex = orderStatusFlow.indexOf(payload.status);
    if (currentIndex === -1 || nextIndex === -1) {
      return res.status(400).json({ error: { code: 'STATUS_INVALID' } });
    }
    if (order.status === 'DELIVERED') {
      return res.status(400).json({ error: { code: 'STATUS_FINAL' } });
    }
    if (nextIndex <= currentIndex) {
      return res.status(400).json({ error: { code: 'STATUS_BACKWARD' } });
    }
    if (nextIndex !== currentIndex + 1) {
      return res.status(400).json({ error: { code: 'STATUS_SKIP_NOT_ALLOWED' } });
    }

    const trackingNumber = payload.trackingNumber ?? order.trackingNumber ?? undefined;
    const carrier = payload.carrier ?? order.carrier ?? undefined;
    if (
      ['HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'].includes(payload.status) &&
      (!trackingNumber || !carrier)
    ) {
      return res.status(400).json({ error: { code: 'TRACKING_REQUIRED' } });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: payload.status,
        statusUpdatedAt: new Date(),
        trackingNumber,
        carrier
      },
      include: {
        items: {
          where: { product: { sellerId: req.user!.userId } },
          include: { product: true, variant: true }
        },
        contact: true,
        shippingAddress: true,
        buyer: true
      }
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listBySeller(req.user!.userId);
    const revenue = orders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemSum, item) => itemSum + item.priceAtPurchase * item.quantity, 0),
      0
    );
    const products = await prisma.product.findMany({ where: { sellerId: req.user!.userId } });
    const statusCounts = orderStatusFlow.reduce(
      (acc, status) => {
        acc[status] = orders.filter((order) => order.status === status).length;
        return acc;
      },
      {} as Record<OrderStatus, number>
    );
    res.json({
      data: {
        totalOrders: orders.length,
        totalRevenue: revenue,
        totalProducts: products.length,
        statusCounts
      }
    });
  } catch (error) {
    next(error);
  }
});

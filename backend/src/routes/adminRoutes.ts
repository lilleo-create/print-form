import { Router } from 'express';
import { z } from 'zod';
import { ProductModerationStatus, ReviewModerationStatus } from '@prisma/client';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { writeLimiter } from '../middleware/rateLimiters';
import { notFound } from '../utils/httpErrors';

export const adminRoutes = Router();

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(1000).optional()
});

const notesSchema = z.object({
  notes: z.string().max(1000).optional()
});

const kycListSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING')
});

const productStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'NEEDS_EDIT',
  'ARCHIVED'
]);

const reviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_EDIT']);

adminRoutes.use(requireAuth, requireAdmin);

const listKycSubmissions = async (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
  return prisma.sellerKycSubmission.findMany({
    where: { status },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      documents: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

const reviewSubmission = async (id: string, status: 'APPROVED' | 'REJECTED', notes?: string | null, reviewerId?: string) => {
  const submission = await prisma.sellerKycSubmission.findUnique({
    where: { id },
    include: { user: true, documents: true }
  });
  if (!submission) {
    return null;
  }
  const updated = await prisma.sellerKycSubmission.update({
    where: { id },
    data: {
      status,
      notes: notes ?? null,
      reviewedAt: new Date(),
      reviewerId: reviewerId ?? null
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      documents: true
    }
  });
  if (status === 'APPROVED') {
    await prisma.user.update({
      where: { id: updated.userId },
      data: { role: 'SELLER' }
    });
  }
  return updated;
};

adminRoutes.get('/kyc', async (req, res, next) => {
  try {
    const query = kycListSchema.parse(req.query);
    const submissions = await listKycSubmissions(query.status);
    res.json({ data: submissions });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/kyc/submissions', async (req, res, next) => {
  try {
    const query = kycListSchema.parse(req.query);
    const submissions = await listKycSubmissions(query.status);
    res.json({ data: submissions });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch('/kyc/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = reviewSchema.parse(req.body);
    const updated = await reviewSubmission(req.params.id, payload.status, payload.notes ?? null, req.user!.userId);
    if (!updated) {
      return notFound(res, 'KYC submission not found');
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/kyc/:id/approve', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = notesSchema.parse(req.body);
    const updated = await reviewSubmission(req.params.id, 'APPROVED', payload.notes ?? null, req.user!.userId);
    if (!updated) {
      return notFound(res, 'KYC submission not found');
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/kyc/:id/reject', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = notesSchema.parse(req.body);
    const updated = await reviewSubmission(req.params.id, 'REJECTED', payload.notes ?? null, req.user!.userId);
    if (!updated) {
      return notFound(res, 'KYC submission not found');
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/products', async (req, res, next) => {
  try {
    const status = productStatusSchema.parse(req.query.status ?? 'PENDING') as ProductModerationStatus;
    const products = await prisma.product.findMany({
      where: { moderationStatus: status },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        images: { orderBy: { sortOrder: 'asc' } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/products/:id/approve', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { publishedAt: true }
    });
    if (!existing) {
      return notFound(res, 'Product not found');
    }
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'APPROVED',
        moderationNotes: null,
        moderatedAt: new Date(),
        moderatedById: req.user!.userId,
        publishedAt: existing.publishedAt ?? new Date()
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/products/:id/reject', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = notesSchema.parse(req.body);
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'REJECTED',
        moderationNotes: payload.notes ?? null,
        moderatedAt: new Date(),
        moderatedById: req.user!.userId
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/products/:id/needs-edit', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = notesSchema.parse(req.body);
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'NEEDS_EDIT',
        moderationNotes: payload.notes ?? null,
        moderatedAt: new Date(),
        moderatedById: req.user!.userId
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.delete('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'ARCHIVED',
        moderatedAt: new Date(),
        moderatedById: req.user!.userId
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

const updateProductRating = async (productId: string) => {
  const aggregate = await prisma.review.aggregate({
    where: { productId, moderationStatus: 'APPROVED', isPublic: true },
    _avg: { rating: true },
    _count: { _all: true }
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: aggregate._avg.rating ?? 0,
      ratingCount: aggregate._count._all ?? 0
    }
  });
};

adminRoutes.get('/reviews', async (req, res, next) => {
  try {
    const status = reviewStatusSchema.parse(req.query.status ?? 'PENDING') as ReviewModerationStatus;
    const reviews = await prisma.review.findMany({
      where: { moderationStatus: status },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, image: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/reviews/:id/approve', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'APPROVED',
        moderationNotes: null,
        moderatedAt: new Date(),
        moderatedById: req.user!.userId,
        status: 'APPROVED'
      }
    });
    await updateProductRating(updated.productId);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/reviews/:id/reject', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = notesSchema.parse(req.body);
    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'REJECTED',
        moderationNotes: payload.notes ?? null,
        moderatedAt: new Date(),
        moderatedById: req.user!.userId,
        status: 'PENDING'
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/reviews/:id/needs-edit', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = notesSchema.parse(req.body);
    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: 'NEEDS_EDIT',
        moderationNotes: payload.notes ?? null,
        moderatedAt: new Date(),
        moderatedById: req.user!.userId,
        status: 'PENDING'
      }
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

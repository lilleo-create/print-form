import { Router } from 'express';
import { z } from 'zod';
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

adminRoutes.use(requireAuth, requireAdmin);

const listPendingSubmissions = async () => {
  return prisma.sellerKycSubmission.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      documents: true
    },
    orderBy: { createdAt: 'asc' }
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

adminRoutes.get('/kyc', async (_req, res, next) => {
  try {
    const submissions = await listPendingSubmissions();
    res.json({ data: submissions });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/kyc/submissions', async (_req, res, next) => {
  try {
    const submissions = await listPendingSubmissions();
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

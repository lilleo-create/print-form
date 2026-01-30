import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { writeLimiter } from '../middleware/rateLimiters';

export const adminRoutes = Router();

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(1000).optional()
});

adminRoutes.use(authenticate, authorize(['ADMIN']));

adminRoutes.get('/kyc', async (_req, res, next) => {
  try {
    const submissions = await prisma.sellerKycSubmission.findMany({
      where: { status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        documents: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ data: submissions });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch('/kyc/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = reviewSchema.parse(req.body);
    const submission = await prisma.sellerKycSubmission.findUnique({
      where: { id: req.params.id },
      include: { user: true, documents: true }
    });
    if (!submission) {
      return res.status(404).json({ error: { code: 'KYC_NOT_FOUND' } });
    }
    const updated = await prisma.sellerKycSubmission.update({
      where: { id: req.params.id },
      data: {
        status: payload.status,
        notes: payload.notes ?? null,
        reviewedAt: new Date(),
        reviewerId: req.user!.userId
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        documents: true
      }
    });
    if (payload.status === 'APPROVED') {
      await prisma.user.update({
        where: { id: updated.userId },
        data: { role: 'SELLER' }
      });
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

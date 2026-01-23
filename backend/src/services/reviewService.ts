import { prisma } from '../lib/prisma';

export const reviewService = {
  async addReview(data: { productId: string; userId: string; rating: number; text: string }) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        select: { ratingAvg: true, ratingCount: true }
      });

      if (!product) {
        throw new Error('NOT_FOUND');
      }

      const nextCount = product.ratingCount + 1;
      const nextAvg = (product.ratingAvg * product.ratingCount + data.rating) / nextCount;

      const review = await tx.review.create({
        data: {
          productId: data.productId,
          userId: data.userId,
          rating: data.rating,
          text: data.text,
          status: 'APPROVED'
        }
      });

      await tx.product.update({
        where: { id: data.productId },
        data: { ratingAvg: nextAvg, ratingCount: nextCount }
      });

      return review;
    });
  },
  listByProduct: (productId: string, page = 1, limit = 5) =>
    prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: { user: { select: { id: true, name: true } } }
    })
};

import { prisma } from '../lib/prisma';

const sortMap = (sort: string) => {
  switch (sort) {
    case 'helpful':
      return [{ likesCount: 'desc' }, { createdAt: 'desc' }];
    case 'high':
      return [{ rating: 'desc' }, { createdAt: 'desc' }];
    case 'low':
      return [{ rating: 'asc' }, { createdAt: 'desc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
};

const buildWhere = (productIds: string[]) => ({
  productId: { in: productIds },
  status: 'APPROVED' as const,
  isPublic: true
});

export const reviewService = {
  async addReview(data: {
    productId: string;
    userId: string;
    rating: number;
    pros: string;
    cons: string;
    comment: string;
    photos?: string[];
  }) {
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
          text: data.comment,
          pros: data.pros,
          cons: data.cons,
          comment: data.comment,
          photos: data.photos ?? [],
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
  listByProduct: (
    productIds: string[],
    page = 1,
    limit = 5,
    sort: 'helpful' | 'rating_desc' | 'rating_asc' | 'new' = 'new'
  ) => {
    const orderBy =
      sort === 'helpful'
        ? { likesCount: 'desc' }
        : sort === 'rating_desc'
          ? { rating: 'desc' }
          : sort === 'rating_asc'
            ? { rating: 'asc' }
            : { createdAt: 'desc' };
    return prisma.review.findMany({
      where: { productId: { in: productIds }, status: 'APPROVED' },
      orderBy,
      take: limit,
      skip: (page - 1) * limit,
      include: { user: { select: { id: true, name: true } } }
    });
  }
};

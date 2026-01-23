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
  status: 'APPROVED' as const
});

export const reviewService = {
  async addReview(data: {
    productId: string;
    userId: string;
    rating: number;
    pros: string;
    cons: string;
    comment: string;
    photos: string[];
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
          pros: data.pros,
          cons: data.cons,
          comment: data.comment,
          photos: data.photos,
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
  listByProduct: (productId: string, page = 1, limit = 5, sort = 'new') =>
    prisma.review.findMany({
      where: buildWhere([productId]),
      orderBy: sortMap(sort),
      take: limit,
      skip: (page - 1) * limit,
      include: { user: { select: { id: true, name: true } } }
    }),
  listByProducts: (productIds: string[], page = 1, limit = 5, sort = 'new') =>
    prisma.review.findMany({
      where: buildWhere(productIds),
      orderBy: sortMap(sort),
      take: limit,
      skip: (page - 1) * limit,
      include: { user: { select: { id: true, name: true } } }
    }),
  countByProduct: (productId: string) =>
    prisma.review.count({
      where: buildWhere([productId])
    }),
  countByProducts: (productIds: string[]) =>
    prisma.review.count({
      where: buildWhere(productIds)
    }),
  async summaryByProduct(productId: string) {
    const reviews = await prisma.review.findMany({
      where: buildWhere([productId]),
      select: { rating: true, photos: true }
    });
    const total = reviews.length;
    const counts = [5, 4, 3, 2, 1].map((value) => ({
      rating: value,
      count: reviews.filter((review) => review.rating === value).length
    }));
    const avg = total
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / total
      : 0;
    const photos = reviews.flatMap((review) => review.photos ?? []);
    return { total, avg, counts, photos };
  },
  async summaryByProducts(productIds: string[]) {
    const reviews = await prisma.review.findMany({
      where: buildWhere(productIds),
      select: { rating: true, photos: true }
    });
    const total = reviews.length;
    const counts = [5, 4, 3, 2, 1].map((value) => ({
      rating: value,
      count: reviews.filter((review) => review.rating === value).length
    }));
    const avg = total
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / total
      : 0;
    const photos = reviews.flatMap((review) => review.photos ?? []);
    return { total, avg, counts, photos };
  }
};

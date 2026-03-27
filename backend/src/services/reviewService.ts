import { prisma } from '../lib/prisma';
import { Prisma, ReviewStatus } from '@prisma/client';

type ReviewOrderBy = Prisma.ReviewOrderByWithRelationInput[];

const sortMap = (sort: string): ReviewOrderBy => {
  switch (sort) {
    case 'helpful':
      // ВАЖНО: likesCount должен существовать в schema.prisma
      return [{ likesCount: 'desc' }, { createdAt: 'desc' }];
    case 'high':
      return [{ rating: 'desc' }, { createdAt: 'desc' }];
    case 'low':
      return [{ rating: 'asc' }, { createdAt: 'desc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
};

const buildApprovedWhere = (productIds: string[]): Prisma.ReviewWhereInput => ({
  productId: { in: productIds },
  moderationStatus: 'APPROVED',
  isPublic: true
});

const buildOwnPendingWhere = (productIds: string[], userId: string): Prisma.ReviewWhereInput => ({
  productId: { in: productIds },
  userId,
  moderationStatus: 'PENDING',
  status: ReviewStatus.PENDING,
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
    photos: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        select: { id: true }
      });

      if (!product) throw new Error('NOT_FOUND');

      const review = await tx.review.create({
        data: {
          productId: data.productId,
          userId: data.userId,
          rating: data.rating,
          pros: data.pros,
          cons: data.cons,
          comment: data.comment,
          photos: data.photos,
          status: ReviewStatus.PENDING,
          moderationStatus: 'PENDING',
          moderationNotes: null,
          moderatedAt: null,
          moderatedById: null
        }
      });

      return review;
    });
  },

  listByProduct: (productId: string, page = 1, limit = 5, sort = 'new', viewerUserId?: string) =>
    reviewService.listByProducts([productId], page, limit, sort, viewerUserId),

  async listByProducts(productIds: string[], page = 1, limit = 5, sort = 'new', viewerUserId?: string) {
    const approvedOrderBy = sortMap(sort);
    const include = { user: { select: { id: true, name: true } } } as const;

    if (!viewerUserId) {
      return prisma.review.findMany({
        where: buildApprovedWhere(productIds),
        orderBy: approvedOrderBy,
        take: limit,
        skip: (page - 1) * limit,
        include
      });
    }

    const ownPending = await prisma.review.findMany({
      where: buildOwnPendingWhere(productIds, viewerUserId),
      orderBy: [{ createdAt: 'desc' }],
      include
    });
    const ownPendingIds = new Set(ownPending.map((review) => review.id));
    const hasOwnPending = ownPending.length > 0;
    const pendingCount = ownPending.length;

    const approvedSkip = Math.max(0, (page - 1) * limit - pendingCount);
    const approvedTake = page === 1 ? Math.max(limit - pendingCount, 0) : limit;
    const approvedWhere: Prisma.ReviewWhereInput = hasOwnPending
      ? {
          ...buildApprovedWhere(productIds),
          NOT: {
            userId: viewerUserId
          }
        }
      : buildApprovedWhere(productIds);

    const approved = approvedTake
      ? await prisma.review.findMany({
          where: approvedWhere,
          orderBy: approvedOrderBy,
          take: approvedTake,
          skip: approvedSkip,
          include
        })
      : [];

    if (page !== 1) {
      return approved;
    }

    const merged = [...ownPending, ...approved.filter((review) => !ownPendingIds.has(review.id))];
    return merged.slice(0, limit);
  },

  countByProduct: (productId: string, viewerUserId?: string) =>
    reviewService.countByProducts([productId], viewerUserId),

  async countByProducts(productIds: string[], viewerUserId?: string) {
    if (!viewerUserId) {
      return prisma.review.count({ where: buildApprovedWhere(productIds) });
    }

    const pendingCount = await prisma.review.count({ where: buildOwnPendingWhere(productIds, viewerUserId) });
    const approvedWhere: Prisma.ReviewWhereInput = pendingCount
      ? {
          ...buildApprovedWhere(productIds),
          NOT: {
            userId: viewerUserId
          }
        }
      : buildApprovedWhere(productIds);

    const approvedCount = await prisma.review.count({ where: approvedWhere });

    return pendingCount + approvedCount;
  },

  async summaryByProduct(productId: string) {
    const grouped = await prisma.review.groupBy({
      by: ['rating'],
      where: buildApprovedWhere([productId]),
      _count: { _all: true }
    });

    const total = grouped.reduce((sum, item) => sum + item._count._all, 0);
    const avg = total
      ? grouped.reduce((sum, item) => sum + item.rating * item._count._all, 0) / total
      : 0;

    const counts = [5, 4, 3, 2, 1].map((value) => ({
      rating: value,
      count: grouped.find((item) => item.rating === value)?._count._all ?? 0
    }));

    const photos = (
      await prisma.review.findMany({
        where: buildApprovedWhere([productId]),
        select: { photos: true }
      })
    ).flatMap((review) => review.photos ?? []);

    return { total, avg, counts, photos };
  },

  async summaryByProducts(productIds: string[]) {
    const grouped = await prisma.review.groupBy({
      by: ['rating'],
      where: buildApprovedWhere(productIds),
      _count: { _all: true }
    });

    const total = grouped.reduce((sum, item) => sum + item._count._all, 0);
    const avg = total
      ? grouped.reduce((sum, item) => sum + item.rating * item._count._all, 0) / total
      : 0;

    const counts = [5, 4, 3, 2, 1].map((value) => ({
      rating: value,
      count: grouped.find((item) => item.rating === value)?._count._all ?? 0
    }));

    const photos = (
      await prisma.review.findMany({
        where: buildApprovedWhere(productIds),
        select: { photos: true }
      })
    ).flatMap((review) => review.photos ?? []);

    return { total, avg, counts, photos };
  },

  listByUser: (userId: string) =>
    prisma.review.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      include: { product: { select: { id: true, title: true, image: true } } }
    }),

  async updateVisibility(id: string, userId: string, isPublic: boolean) {
    const review = await prisma.review.findFirst({ where: { id, userId } });
    if (!review) throw new Error('NOT_FOUND');

    return prisma.review.update({
      where: { id },
      data: { isPublic }
    });
  }
};

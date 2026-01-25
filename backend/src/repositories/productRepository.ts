import { prisma } from '../lib/prisma';

export interface ProductInput {
  title: string;
  category: string;
  price: number;
  image: string;
  imageUrls?: string[];
  description: string;
  descriptionShort: string;
  descriptionFull: string;
  sku: string;
  currency: string;
  material: string;
  size: string;
  technology: string;
  printTime: string;
  color: string;
  deliveryDateEstimated?: Date | string | null;
  deliveryDates?: string[];
  sellerId: string;
}

export const productRepository = {
  findMany: (filters: {
    category?: string;
    material?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
    ratingMin?: number;
    color?: string;
    sort?: 'createdAt' | 'rating';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    cursor?: string;
  }) => {
    const sortField = filters.sort === 'rating' ? 'ratingAvg' : 'createdAt';
    const orderBy = { [sortField]: filters.order ?? 'desc' } as const;
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 12;
    const skip = (page - 1) * limit;
    const hasCursor = Boolean(filters.cursor);
    const cursor = filters.cursor ? { id: filters.cursor } : undefined;
    const searchQuery = filters.q?.trim();
    const where = {
      category: filters.category || undefined,
      material: filters.material || undefined,
      size: filters.size || undefined,
      color: filters.color
        ? {
            equals: filters.color,
            mode: 'insensitive'
          }
        : undefined,
      ratingAvg: filters.ratingMin ? { gte: filters.ratingMin } : undefined,
      price: {
        gte: filters.minPrice,
        lte: filters.maxPrice
      },
      OR: searchQuery
        ? [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
            { descriptionShort: { contains: searchQuery, mode: 'insensitive' } },
            { descriptionFull: { contains: searchQuery, mode: 'insensitive' } }
          ]
        : undefined
    };
    return prisma.product.findMany({
      where,
      orderBy,
      take: limit,
      skip: hasCursor ? 1 : skip,
      cursor
    });
  },
  findById: (id: string) =>
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        specs: { orderBy: { sortOrder: 'asc' } }
      }
    }),
  create: (data: ProductInput) => {
    const { imageUrls, ...rest } = data;
    return prisma.product.create({
      data: {
        ...rest,
        images: imageUrls?.length
          ? {
              create: imageUrls.map((url, index) => ({
                url,
                sortOrder: index
              }))
            }
          : undefined
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });
  },
  update: async (id: string, data: Partial<ProductInput>) => {
    const { imageUrls, ...rest } = data;
    if (!imageUrls) {
      return prisma.product.update({ where: { id }, data: rest });
    }
    return prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: rest });
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (imageUrls.length > 0) {
        await tx.productImage.createMany({
          data: imageUrls.map((url, index) => ({
            productId: id,
            url,
            sortOrder: index
          }))
        });
      }
      return tx.product.findUnique({
        where: { id },
        include: { images: { orderBy: { sortOrder: 'asc' } } }
      });
    });
  },
  remove: (id: string) => prisma.product.delete({ where: { id } })
};

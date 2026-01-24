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
    sort?: 'createdAt' | 'rating';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => {
    const sortField = filters.sort === 'rating' ? 'ratingAvg' : 'createdAt';
    const orderBy = { [sortField]: filters.order ?? 'desc' } as const;
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 12;
    const skip = (page - 1) * limit;
    return prisma.product.findMany({
      where: {
        category: filters.category,
        material: filters.material,
        size: filters.size,
        price: {
          gte: filters.minPrice,
          lte: filters.maxPrice
        }
      },
      orderBy,
      take: limit,
      skip
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

import { prisma } from '../lib/prisma';

export interface ProductInput {
  title: string;
  category: string;
  price: number;
  image: string;
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
  create: (data: ProductInput) => prisma.product.create({ data }),
  update: (id: string, data: Partial<ProductInput>) =>
    prisma.product.update({ where: { id }, data }),
  remove: (id: string) => prisma.product.delete({ where: { id } })
};

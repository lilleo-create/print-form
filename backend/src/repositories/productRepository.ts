import { prisma } from '../lib/prisma';

export interface ProductInput {
  title: string;
  category: string;
  price: number;
  image: string;
  description: string;
  material: string;
  size: string;
  technology: string;
  printTime: string;
  color: string;
  sellerId: string;
}

export const productRepository = {
  findMany: (filters: { category?: string; material?: string; minPrice?: number; maxPrice?: number }) => {
    return prisma.product.findMany({
      where: {
        category: filters.category,
        material: filters.material,
        price: {
          gte: filters.minPrice,
          lte: filters.maxPrice
        }
      }
    });
  },
  findById: (id: string) => prisma.product.findUnique({ where: { id } }),
  create: (data: ProductInput) => prisma.product.create({ data }),
  update: (id: string, data: Partial<ProductInput>) =>
    prisma.product.update({ where: { id }, data }),
  remove: (id: string) => prisma.product.delete({ where: { id } })
};

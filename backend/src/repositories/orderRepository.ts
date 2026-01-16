import { prisma } from '../lib/prisma';

export const orderRepository = {
  create: (data: {
    buyerId: string;
    total: number;
    items: { productId: string; quantity: number }[];
  }) =>
    prisma.order.create({
      data: {
        buyerId: data.buyerId,
        total: data.total,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        }
      },
      include: { items: { include: { product: true } } }
    }),
  findByBuyer: (buyerId: string) =>
    prisma.order.findMany({
      where: { buyerId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    }),
  findById: (id: string) =>
    prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } }
    }),
  findSellerOrders: (sellerId: string) =>
    prisma.order.findMany({
      where: { items: { some: { product: { sellerId } } } },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })
};

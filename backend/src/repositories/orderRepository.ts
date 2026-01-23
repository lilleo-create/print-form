import { prisma } from '../lib/prisma';

export const orderRepository = {
  create: (data: {
    buyerId: string;
    items: { productId: string; variantId?: string; quantity: number }[];
  }) =>
    prisma.$transaction(async (tx) => {
      const productIds = data.items.map((item) => item.productId);
      const variantIds = data.items.map((item) => item.variantId).filter(Boolean) as string[];

      const products = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const variants = variantIds.length
        ? await tx.productVariant.findMany({ where: { id: { in: variantIds } } })
        : [];

      const itemsWithPrice = data.items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
          throw new Error('NOT_FOUND');
        }
        const variant = item.variantId
          ? variants.find((entry) => entry.id === item.variantId)
          : undefined;
        const priceAtPurchase = product.price + (variant?.priceDelta ?? 0);
        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          priceAtPurchase,
          currency: product.currency
        };
      });

      const total = itemsWithPrice.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0);

      return tx.order.create({
        data: {
          buyerId: data.buyerId,
          total,
          items: {
            create: itemsWithPrice
          }
        },
        include: { items: { include: { product: true, variant: true } } }
      });
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

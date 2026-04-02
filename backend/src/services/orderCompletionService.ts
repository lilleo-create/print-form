import { prisma } from '../lib/prisma';
import { payoutService } from './payoutService';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type OrderLike = {
  total?: number | null;
  deliveryPrice?: number | null;
  items?: Array<{
    priceAtPurchase?: number | null;
    quantity?: number | null;
  }>;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
};

export const orderCompletionService = {
  async releaseFundsForCompletedOrder(orderId: string, tx?: TxClient) {
    return payoutService.releaseForDeliveredOrder(orderId, tx);
  },

  buildOrderFinanceBreakdown(order: OrderLike) {
    const itemsTotal = (order.items ?? []).reduce((sum, item) => {
      const itemPrice = toNumber(item.priceAtPurchase);
      const itemQty = toNumber(item.quantity);
      return sum + itemPrice * itemQty;
    }, 0);

    const deliveryPrice = toNumber(order.deliveryPrice);
    const total = toNumber(order.total) || itemsTotal + deliveryPrice;

    return {
      itemsTotal,
      deliveryPrice,
      total
    };
  }
};

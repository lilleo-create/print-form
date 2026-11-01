import type { Order } from '../types';

export const paymentSecondsRemaining = (deadline: string | null | undefined, now = Date.now()) => {
  if (!deadline) return null;
  const expiry = Date.parse(deadline);
  if (!Number.isFinite(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - now) / 1000));
};

export type BuyerCancellationAction = 'cancel' | 'request' | 'support' | null;

export const buyerCancellationAction = (order: Order): BuyerCancellationAction => {
  if (order.isExpired) return null;
  if (['CANCELLED', 'EXPIRED', 'DELIVERED', 'RETURNED'].includes(order.status)) return null;
  if (order.status === 'CREATED' && order.paymentStatus === 'PENDING_PAYMENT') return 'cancel';
  if (order.status === 'PAID' && order.paymentStatus === 'PAID' && order.paidAt &&
      !order.cdekOrderId && !order.shipment?.id && !order.readyForShipmentAt) return 'cancel';
  if (order.paymentStatus !== 'PAID' || !order.paidAt) return null;
  if (['HANDED_TO_DELIVERY', 'IN_TRANSIT'].includes(order.status) || order.cdekOrderId || order.shipment?.id) return 'support';
  return 'request';
};

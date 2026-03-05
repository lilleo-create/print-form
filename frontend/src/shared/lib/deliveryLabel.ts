import type { Order } from '../types';

export const getOrderDeliveryLabel = (order: Pick<Order, 'delivery'>) => {
  if (!order.delivery) return null;

  if (order.delivery.deliveryMethod === 'COURIER') {
    const line = [order.delivery.courierAddress?.line1, order.delivery.courierAddress?.city].filter(Boolean).join(', ');
    return `Курьер: ${line || 'адрес уточняется'}`;
  }

  if (order.delivery.pickupPoint) {
    return `ПВЗ: ${order.delivery.pickupPoint.fullAddress} (ID: ${order.delivery.pickupPoint.id})`;
  }

  return 'ПВЗ: не выбран';
};

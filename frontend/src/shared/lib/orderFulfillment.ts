import type { Order } from '../types';

export const readyToShipDisabledReason = (order: Order, dropoffPvzId?: string | null): string | null => {
  if (order.status === 'CANCELLED') return 'Заказ отменён';
  if (['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'].includes(order.paymentStatus ?? '')) {
    return 'Оплата возвращается';
  }
  if (!order.paidAt || order.paymentStatus !== 'PAID') return 'Ожидает оплаты';
  if (order.status !== 'PRINTING') return 'Сначала начните производство';
  if (!order.isPacked || !order.packedWeightGrams || !order.packedLengthCm ||
      !order.packedWidthCm || !order.packedHeightCm || !order.packedDeliveryAmountKopecks) {
    return 'Сначала укажите параметры готовой посылки';
  }
  if ((order.financials?.sellerNetAfterDeliveryAmount ?? 0) < 0) {
    return 'Стоимость доставки превышает сумму к выплате';
  }
  if (!order.sellerDropoffPvzMeta && !dropoffPvzId) return 'Не выбран ПВЗ сдачи';
  if (!order.buyerPickupPvzMeta && !order.shippingAddressId) return 'Не указан адрес доставки';
  if (order.shipment?.status && ['DELIVERED', 'CANCELLED', 'FAILED'].includes(order.shipment.status)) {
    return 'Доставка завершена';
  }
  return null;
};

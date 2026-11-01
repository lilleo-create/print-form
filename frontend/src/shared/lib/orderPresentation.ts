import type { Order } from '../types';

export type OrderStep = { key: string; label: string; complete: boolean; current: boolean; date: string | null };

export const getOrderSteps = (order: Order, role: 'seller' | 'buyer'): OrderStep[] => {
  const shipment = Boolean(order.cdekOrderId || order.shipment?.id || order.readyForShipmentAt);
  const status = String(order.status ?? '').toUpperCase();
  const delivery = String(order.deliveryStatus ?? order.shipment?.status ?? order.deliveryStatusCode ?? order.cdekStatus ?? '').toUpperCase();
  const handed = ['HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'].includes(status) ||
    /ACCEPTED|HANDED|RECEIVED_AT_SHIPMENT_WAREHOUSE|IN_TRANSIT|DELIVERED|READY_FOR_PICKUP/.test(delivery);
  const transit = ['IN_TRANSIT', 'DELIVERED'].includes(status) || /IN_TRANSIT|DELIVERED|READY_FOR_PICKUP/.test(delivery);
  const ready = /READY_FOR_PICKUP|READY_FOR_RECEIVE|AVAILABLE_FOR_PICKUP/.test(delivery) ||
    /READY_FOR_PICKUP/.test(String(order.deliveryStatusLabel ?? '').toUpperCase());
  const delivered = status === 'DELIVERED' || /DELIVERED/.test(delivery);
  const paid = order.paymentStatus === 'PAID' && Boolean(order.paidAt);
  const producing = paid && (status === 'PRINTING' || Boolean(order.isPacked) || shipment || handed);
  const eventDate = (pattern: RegExp) => order.deliveryEvents?.find(event => pattern.test(event.status.toUpperCase()))?.timestampUtc ?? null;
  const all = [
    { key: 'paid', label: paid ? (role === 'seller' ? 'Оплачен' : 'Заказ оплачен') : 'Ожидает оплаты', complete: paid, date: paid ? order.paidAt ?? null : null },
    { key: 'production', label: role === 'seller' ? 'Производство' : 'Продавец готовит заказ', complete: producing, date: null },
    ...(role === 'seller' ? [
      { key: 'packed', label: 'Упакован', complete: Boolean(order.isPacked && order.packedAt), date: order.packedAt ?? null },
      { key: 'created', label: 'Заявка CDEK создана', complete: shipment, date: order.readyForShipmentAt ?? null }
    ] : []),
    { key: 'handed', label: 'Передан в CDEK', complete: handed, date: eventDate(/ACCEPTED|HANDED|RECEIVED_AT_SHIPMENT_WAREHOUSE/) },
    { key: 'transit', label: 'В пути', complete: transit, date: eventDate(/IN_TRANSIT/) },
    { key: 'pickup', label: 'Ждёт в пункте выдачи', complete: ready || delivered, date: eventDate(/READY_FOR_PICKUP|READY_FOR_RECEIVE|AVAILABLE_FOR_PICKUP/) },
    { key: 'delivered', label: 'Получен', complete: delivered, date: order.deliveredToRecipientAt ?? eventDate(/DELIVERED/) }
  ];
  const lastComplete = all.reduce((last, step, index) => step.complete ? index : last, -1);
  return all.map((step, index) => ({ ...step, current: index === Math.max(0, lastComplete) }));
};

export const getHumanOrderStatus = (order: Order): string => {
  if (order.status === 'EXPIRED' || order.paymentStatus === 'PAYMENT_EXPIRED' || order.isExpired) return 'Время на оплату истекло';
  if (order.status === 'PAYMENT_FAILED') return 'Не удалось оплатить';
  if (order.status === 'CANCELLED' && order.paymentStatus === 'REFUND_PENDING') return 'Заказ отменён · Возврат денег обрабатывается';
  if (order.status === 'CANCELLED' && order.paymentStatus === 'REFUNDED') return 'Заказ отменён · Деньги возвращены';
  if (order.status === 'CANCELLED') return 'Заказ отменён';
  if (order.status === 'RETURNED') return 'Возврат';
  if (order.paymentStatus !== 'PAID' || !order.paidAt) return 'Ожидает оплаты';
  if (order.status === 'DELIVERED') return 'Получен';
  const steps = getOrderSteps(order, 'seller');
  if (steps.find(step => step.key === 'pickup')?.complete) return 'Ждёт в пункте выдачи';
  if (steps.find(step => step.key === 'transit')?.complete) return 'В пути';
  if (steps.find(step => step.key === 'handed')?.complete) return 'Передан в CDEK';
  if (order.shipment?.readbackStatus === 'PENDING') return 'Заявка создана в CDEK, подтверждаем данные';
  if (order.shipment?.readbackStatus === 'AUTH_FAILED') return 'Заявка создана. Статус доставки уточняется';
  if (order.cdekOrderId || order.shipment?.id) return 'Ожидает передачи в CDEK';
  if (order.isPacked) return 'Упакован';
  if (order.status === 'PRINTING') return 'Производство';
  return 'Оплачен';
};

export const getSellerNextAction = (order: Order): 'production' | 'pack' | 'shipment' | 'handoff' | 'tracking' | null => {
  if (order.paymentStatus !== 'PAID' || !order.paidAt || ['CANCELLED', 'DELIVERED', 'RETURNED'].includes(order.status)) return null;
  if (order.cdekOrderId || order.shipment?.id) return getOrderSteps(order, 'seller').find(step => step.key === 'handed')?.complete ? 'tracking' : 'handoff';
  if (order.status === 'PAID') return 'production';
  if (order.status === 'PRINTING') return order.isPacked ? 'shipment' : 'pack';
  return null;
};

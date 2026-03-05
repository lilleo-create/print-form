import { Order } from '../types';

type DeliveryStatusSource = Pick<Order, 'status' | 'shipment' | 'trackingNumber'>;

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  READY_TO_SHIP: 'Готов к сдаче в ПВЗ',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Отменено',
  FAILED: 'Ошибка доставки',
  VALIDATING: 'Оформляется',
  CREATED: 'Оформляется'
};

export const getDeliveryStatusLabel = (order: DeliveryStatusSource): string => {
  const shipmentStatus = order.shipment?.status;
  if (shipmentStatus) {
    if (shipmentStatus === 'READY_TO_SHIP' && !order.trackingNumber) {
      return 'Оформляется (получаем трек-номер)';
    }

    return SHIPMENT_STATUS_LABELS[shipmentStatus] ?? shipmentStatus;
  }

  return SHIPMENT_STATUS_LABELS[order.status] ?? order.status;
};


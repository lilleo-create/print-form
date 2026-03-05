import { Order } from '../types';

export type DeliveryStage = 'CREATING' | 'PRINTING' | 'READY_FOR_DROP' | 'IN_TRANSIT' | 'READY_FOR_PICKUP';

type DeliveryStatusSource = Pick<Order, 'status' | 'paidAt' | 'shipment' | 'trackingNumber' | 'cdekOrderId' | 'readyForShipmentAt'>;

const IN_TRANSIT_STATUSES = new Set(['IN_TRANSIT', 'ACCEPTED_IN_TRANSIT_CITY', 'TRANSPORTING', 'ACCEPTED', 'DELIVERY_TRANSPORTATION']);
const READY_FOR_PICKUP_STATUSES = new Set(['READY_FOR_PICKUP', 'READY_FOR_PICKUP_POINT', 'DELIVERY_AT_PICKUP_POINT']);
const DELIVERED_STATUSES = new Set(['DELIVERED', 'ISSUED']);
const CREATING_STATUSES = new Set(['CREATED', 'VALIDATING', 'NEW', 'CREATING']);
const PRINTING_STATUSES = new Set(['PRINTING', 'DOCS_PRINTING']);
const PVZ_DROPOFF_STATUSES = new Set(['ACCEPTED_AT_SOURCE_WAREHOUSE', 'ACCEPTED_AT_PICK_UP_POINT', 'HANDED_TO_CDEK']);

const normalizeStatus = (status?: string | null) => String(status ?? '').toUpperCase();
const isPaid = (order: DeliveryStatusSource) => Boolean(order.paidAt);

export const hasHandoverStarted = (order: DeliveryStatusSource) => Boolean(order.readyForShipmentAt) || Boolean(order.shipment);

export const getDeliveryStage = (order: DeliveryStatusSource): DeliveryStage => {
  const shipmentStatus = normalizeStatus(order.shipment?.status);
  if (DELIVERED_STATUSES.has(shipmentStatus)) return 'READY_FOR_PICKUP';
  if (READY_FOR_PICKUP_STATUSES.has(shipmentStatus) && isPaid(order)) return 'READY_FOR_PICKUP';
  if (IN_TRANSIT_STATUSES.has(shipmentStatus)) return 'IN_TRANSIT';
  if (PVZ_DROPOFF_STATUSES.has(shipmentStatus)) return 'READY_FOR_DROP';
  if (shipmentStatus === 'READY_FOR_DROP' || (shipmentStatus === 'READY_TO_SHIP' && (order.trackingNumber || order.cdekOrderId))) return 'READY_FOR_DROP';
  if (PRINTING_STATUSES.has(shipmentStatus) || (shipmentStatus && order.status === 'PRINTING')) return 'PRINTING';
  return 'CREATING';
};

const DELIVERY_STAGE_LABELS: Record<DeliveryStage, string> = {
  CREATING: 'Оформляется',
  PRINTING: 'Печатается',
  READY_FOR_DROP: 'Передается в ПВЗ',
  IN_TRANSIT: 'В пути',
  READY_FOR_PICKUP: 'Готов к выдаче'
};

export const getDeliveryStatusLabel = (order: DeliveryStatusSource): string => {
  const shipmentStatus = normalizeStatus(order.shipment?.status);
  if (shipmentStatus === 'READY_TO_SHIP' && !order.trackingNumber) return 'Передается в ПВЗ';
  if (DELIVERED_STATUSES.has(shipmentStatus)) return 'Выдан';
  if (PVZ_DROPOFF_STATUSES.has(shipmentStatus)) return 'Передается в ПВЗ';
  return DELIVERY_STAGE_LABELS[getDeliveryStage(order)];
};

export const isDeliveredDeliveryStage = (order: DeliveryStatusSource) => DELIVERED_STATUSES.has(normalizeStatus(order.shipment?.status));
export const isCancellableDeliveryStage = (order: DeliveryStatusSource) => !hasHandoverStarted(order);

export const getExternalDeliveryStatusLabel = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  if (DELIVERED_STATUSES.has(normalized)) return 'Выдан';
  if (READY_FOR_PICKUP_STATUSES.has(normalized)) return DELIVERY_STAGE_LABELS.READY_FOR_PICKUP;
  if (IN_TRANSIT_STATUSES.has(normalized)) return DELIVERY_STAGE_LABELS.IN_TRANSIT;
  if (PVZ_DROPOFF_STATUSES.has(normalized)) return 'Передается в ПВЗ';
  if (normalized === 'READY_FOR_DROP' || normalized === 'READY_TO_SHIP') return DELIVERY_STAGE_LABELS.READY_FOR_DROP;
  if (PRINTING_STATUSES.has(normalized)) return DELIVERY_STAGE_LABELS.PRINTING;
  if (CREATING_STATUSES.has(normalized)) return DELIVERY_STAGE_LABELS.CREATING;
  return status ?? '—';
};

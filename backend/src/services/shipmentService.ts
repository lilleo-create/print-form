import type { OrderShipment, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { cdekService } from './cdekService';

export type ShipmentInternalStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

const FINAL_STATUSES: ShipmentInternalStatus[] = ['DELIVERED', 'CANCELLED', 'FAILED'];

export const mapYandexStatusToInternal = (status?: string | null): ShipmentInternalStatus => {
  const normalized = (status ?? '').toUpperCase();
  if (['DELIVERY_DELIVERED', 'DELIVERED'].includes(normalized)) return 'DELIVERED';
  if (['CANCELLED', 'DELIVERY_CANCELLED'].includes(normalized)) return 'CANCELLED';
  if (['DRAFT', 'VALIDATING'].includes(normalized)) return 'VALIDATING';
  if (['CREATED', 'ACCEPTED', 'READY_FOR_PICKUP', 'READY_TO_SHIP'].includes(normalized)) return 'READY_TO_SHIP';
  if (
    ['DELIVERY_ARRIVED_PICKUP_POINT', 'DELIVERY_TRANSPORTATION', 'IN_TRANSIT', 'DELIVERY_TRANSMITTED_TO_RECIPIENT'].includes(
      normalized
    )
  ) {
    return 'IN_TRANSIT';
  }
  return 'CREATED';
};

const ensureShipmentTables = async () => undefined;

const toJson = (value: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined =>
  value ? (value as Prisma.InputJsonObject) : undefined;

const makeError = (code: string) => {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
};

export const markReadyToShipCdek = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true, variant: true } },
      buyer: true,
      contact: true
    }
  });

  if (!order) throw makeError('ORDER_NOT_FOUND');
  if (order.status !== 'PAID' || !order.paidAt) throw makeError('ORDER_NOT_PAID');

  const fromPvzCode = String(order.sellerDropoffPvzId ?? '').trim();
  const toPvzCode = String(order.buyerPickupPvzId ?? '').trim();
  if (!fromPvzCode) throw makeError('CDEK_DROPOFF_PVZ_NOT_SET');
  if (!toPvzCode) throw makeError('CDEK_DESTINATION_PVZ_MISSING');

  const recipientName =
    String(order.recipientName ?? '').trim() ||
    String(order.contact?.name ?? '').trim() ||
    String(order.buyer?.name ?? '').trim() ||
    'Получатель';

  const recipientPhone =
    String(order.recipientPhone ?? '').trim() ||
    String(order.contact?.phone ?? '').trim() ||
    String(order.buyer?.phone ?? '').trim();
  if (!recipientPhone) throw makeError('RECIPIENT_PHONE_REQUIRED');

  const items = order.items.map((item) => ({
    id: item.id,
    name: item.product.title,
    article: item.variant?.sku ?? item.product.sku,
    price: item.priceAtPurchase,
    quantity: item.quantity
  }));

  const totalWeight = order.items.reduce((sum, item) => sum + (item.product.weightGrossG ?? 0) * item.quantity, 0);
  const firstProduct = order.items[0]?.product;

  const created = await cdekService.createOrderFromMarketplaceOrder({
    orderId: order.id,
    fromPvzCode,
    toPvzCode,
    recipientName,
    recipientPhone,
    items,
    comment: `Order ${order.id}`,
    weightGrams: totalWeight > 0 ? totalWeight : undefined,
    lengthCm: firstProduct?.dxCm ?? undefined,
    widthCm: firstProduct?.dyCm ?? undefined,
    heightCm: firstProduct?.dzCm ?? undefined
  });

  const now = new Date();

  const shipment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const nextShipment = await tx.orderShipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: 'CDEK',
        deliveryMethod: 'PICKUP_POINT',
        sourceStationId: fromPvzCode,
        destinationStationId: toPvzCode,
        requestId: created.cdekOrderId,
        status: 'READY_TO_SHIP',
        statusRaw: {
          cdek_order_uuid: created.cdekOrderId,
          trackingNumber: created.trackingNumber ?? ''
        },
        lastSyncAt: now
      },
      update: {
        provider: 'CDEK',
        deliveryMethod: 'PICKUP_POINT',
        sourceStationId: fromPvzCode,
        destinationStationId: toPvzCode,
        requestId: created.cdekOrderId,
        status: 'READY_TO_SHIP',
        statusRaw: {
          cdek_order_uuid: created.cdekOrderId,
          trackingNumber: created.trackingNumber ?? ''
        },
        lastSyncAt: now
      }
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        carrier: 'CDEK',
        cdekOrderId: created.cdekOrderId,
        cdekStatus: 'READY_TO_SHIP',
        trackingNumber: created.trackingNumber || null,
        readyForShipmentAt: now,
        statusUpdatedAt: now
      }
    });

    await tx.orderShipmentStatusHistory.create({
      data: {
        shipmentId: nextShipment.id,
        status: 'READY_TO_SHIP',
        payloadRaw: {
          cdek_order_uuid: created.cdekOrderId,
          trackingNumber: created.trackingNumber ?? ''
        }
      }
    });

    return nextShipment;
  });

  return {
    shipment,
    cdek: {
      cdekOrderId: created.cdekOrderId,
      trackingNumber: created.trackingNumber
    }
  };
};

export const shipmentService = {
  ensure: ensureShipmentTables,
  isFinalStatus: (status: ShipmentInternalStatus) => FINAL_STATUSES.includes(status),

  getByOrderIds: async (orderIds: string[]): Promise<Map<string, OrderShipment>> => {
    await ensureShipmentTables();
    if (!orderIds.length) return new Map<string, OrderShipment>();

    const shipments = await prisma.orderShipment.findMany({
      where: { orderId: { in: orderIds } }
    });

    return new Map(shipments.map((shipment) => [shipment.orderId, shipment]));
  },

  getByOrderId: async (orderId: string) => {
    await ensureShipmentTables();
    return prisma.orderShipment.findUnique({ where: { orderId } });
  },

  getById: async (shipmentId: string) => {
    await ensureShipmentTables();
    return prisma.orderShipment.findUnique({ where: { id: shipmentId } });
  },

  upsertForOrder: async (payload: {
    orderId: string;
    deliveryMethod: 'COURIER' | 'PICKUP_POINT';
    sourceStationId: string;
    sourceStationSnapshot?: Record<string, unknown>;
    destinationStationId: string;
    destinationStationSnapshot?: Record<string, unknown>;
    offerPayload?: string | null;
    requestId?: string | null;
    status: ShipmentInternalStatus;
    statusRaw?: Record<string, unknown>;
    lastSyncAt?: Date | null;
  }) => {
    await ensureShipmentTables();

    return prisma.orderShipment.upsert({
      where: { orderId: payload.orderId },
      create: {
        orderId: payload.orderId,
        provider: 'CDEK',
        deliveryMethod: payload.deliveryMethod,
        sourceStationId: payload.sourceStationId,
        sourceStationSnapshot: toJson(payload.sourceStationSnapshot),
        destinationStationId: payload.destinationStationId,
        destinationStationSnapshot: toJson(payload.destinationStationSnapshot),
        offerPayload: payload.offerPayload ?? null,
        requestId: payload.requestId ?? null,
        status: payload.status,
        statusRaw: toJson(payload.statusRaw),
        lastSyncAt: payload.lastSyncAt ?? null
      },
      update: {
        provider: 'CDEK',
        deliveryMethod: payload.deliveryMethod,
        sourceStationId: payload.sourceStationId,
        sourceStationSnapshot: toJson(payload.sourceStationSnapshot),
        destinationStationId: payload.destinationStationId,
        destinationStationSnapshot: toJson(payload.destinationStationSnapshot),
        offerPayload: payload.offerPayload ?? undefined,
        requestId: payload.requestId ?? undefined,
        status: payload.status,
        statusRaw: toJson(payload.statusRaw),
        lastSyncAt: payload.lastSyncAt ?? null
      }
    });
  },

  pushHistory: async (shipmentId: string, status: ShipmentInternalStatus, payloadRaw: Record<string, unknown>) => {
    await ensureShipmentTables();
    await prisma.orderShipmentStatusHistory.create({
      data: {
        shipmentId,
        status,
        payloadRaw: payloadRaw as Prisma.InputJsonObject
      }
    });
  },

  listForSync: async () => {
    await ensureShipmentTables();
    return prisma.orderShipment.findMany({
      where: {
        requestId: { not: null },
        status: { notIn: FINAL_STATUSES }
      },
      orderBy: { updatedAt: 'asc' },
      take: 100
    });
  },

  readyToShipCdek: async (params: { orderId: string; sellerId: string }) => {
    void params.sellerId;
    return markReadyToShipCdek(params.orderId);
  },

  getCdekShippingLabelPdf: async (params: { orderId: string; sellerId: string }): Promise<Buffer> => {
    const order = await prisma.order.findFirst({
      where: {
        id: params.orderId,
        items: { some: { product: { sellerId: params.sellerId } } }
      }
    });

    if (!order) throw makeError('ORDER_NOT_FOUND');
    if (order.status !== 'PAID' || !order.paidAt) throw makeError('ORDER_NOT_PAID');

    const shipment = await prisma.orderShipment.findUnique({ where: { orderId: order.id } });
    const orderUuid = String(order.cdekOrderId ?? shipment?.requestId ?? '').trim();
    if (!orderUuid) throw makeError('CDEK_ORDER_UUID_MISSING');

    return cdekService.getWaybillPdfByOrderUuid(orderUuid);
  }
};

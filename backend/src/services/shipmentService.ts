import { randomUUID } from 'node:crypto';
import type { Order, OrderShipment, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { cdekService, type CdekOrderSnapshot } from './cdekService';

export type ShipmentInternalStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

const FINAL_STATUSES: ShipmentInternalStatus[] = ['DELIVERED', 'CANCELLED', 'FAILED'];
const CDEK_PVZ_CODE_REGEX = /^[A-Z]{3}\d{2,6}$/;

export const mapExternalStatusToInternal = (status?: string | null): ShipmentInternalStatus => {
  const normalized = (status ?? '').toUpperCase();
  if (['DELIVERY_DELIVERED', 'DELIVERED'].includes(normalized)) return 'DELIVERED';
  if (['CANCELLED', 'DELIVERY_CANCELLED', 'INVALID', 'REFUSED'].includes(normalized)) return 'CANCELLED';
  if (['DRAFT', 'VALIDATING'].includes(normalized)) return 'VALIDATING';
  if (['CREATED', 'ACCEPTED', 'READY_FOR_PICKUP', 'READY_TO_SHIP'].includes(normalized)) return 'READY_TO_SHIP';
  if (['DELIVERY_ARRIVED_PICKUP_POINT', 'DELIVERY_TRANSPORTATION', 'IN_TRANSIT', 'DELIVERY_TRANSMITTED_TO_RECIPIENT'].includes(normalized)) {
    return 'IN_TRANSIT';
  }
  return 'CREATED';
};

const ensureShipmentTables = async () => undefined;

const toJson = (value: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined =>
  value ? (value as Prisma.InputJsonObject) : undefined;

const makeError = (code: string, message?: string) => {
  const error = new Error(message ?? code) as Error & { code: string };
  error.code = code;
  return error;
};

const safeRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const detectClientNumber = (order: Pick<Order, 'id' | 'orderLabels'>) => {
  const labels = Array.isArray(order.orderLabels) ? (order.orderLabels as Array<{ code?: string }>) : [];
  const primary = String(labels[0]?.code ?? '').trim();
  if (primary) return primary;
  return `PF-${order.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
};

const parsePvzProvider = (meta: unknown) => String(safeRecord(meta).provider ?? '').trim().toUpperCase();

export const normalizePvzProvider = async <T extends Pick<Order, 'id' | 'carrier' | 'buyerPickupPvzId' | 'buyerPickupPvzMeta'>>(order: T) => {
  const carrier = String(order.carrier ?? '').toUpperCase();
  const pvzId = String(order.buyerPickupPvzId ?? '').trim().toUpperCase();
  const currentProvider = parsePvzProvider(order.buyerPickupPvzMeta);

  if (carrier !== 'CDEK' || !CDEK_PVZ_CODE_REGEX.test(pvzId) || currentProvider === 'CDEK') {
    return order;
  }

  const nextMeta = {
    ...safeRecord(order.buyerPickupPvzMeta),
    provider: 'CDEK',
    pvzId
  };

  await prisma.order.update({
    where: { id: order.id },
    data: { buyerPickupPvzMeta: nextMeta as unknown as Prisma.InputJsonValue }
  });

  return { ...order, buyerPickupPvzMeta: nextMeta };
};

const buildStatusRaw = (snapshot: CdekOrderSnapshot, fallbackUuid: string) => ({
  cdek_order_uuid: snapshot.cdekOrderId || fallbackUuid,
  cdek_request_uuid: snapshot.requestUuid || '',
  cdek_state: snapshot.status || '',
  trackingNumber: snapshot.trackingNumber || '',
  print: {
    waybillUrl: snapshot.relatedEntities.waybillUrl,
    barcodeUrls: snapshot.relatedEntities.barcodeUrls
  },
  related_entities: snapshot.raw.related_entities ?? []
});

const syncShipmentByOrder = async (orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) throw makeError('ORDER_NOT_FOUND');

  const cdekOrderUuid = String(order.cdekOrderId ?? '').trim() || String((order.shipment?.statusRaw as any)?.cdek_order_uuid ?? '').trim();
  if (!cdekOrderUuid) throw makeError('CDEK_ORDER_UUID_MISSING');

  const snapshot = await cdekService.getOrderByUuid(cdekOrderUuid);
  const nextStatus = mapExternalStatusToInternal(snapshot.status);
  const statusRaw = buildStatusRaw(snapshot, cdekOrderUuid);

  const updated = await prisma.$transaction(async (tx) => {
    const shipment = await tx.orderShipment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: 'CDEK',
        deliveryMethod: 'PICKUP_POINT',
        sourceStationId: String(order.sellerDropoffPvzId ?? ''),
        destinationStationId: String(order.buyerPickupPvzId ?? ''),
        requestId: snapshot.requestUuid || null,
        status: nextStatus,
        statusRaw,
        lastSyncAt: new Date()
      },
      update: {
        requestId: snapshot.requestUuid || undefined,
        status: nextStatus,
        statusRaw,
        lastSyncAt: new Date()
      }
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        cdekStatus: snapshot.status || undefined,
        cdekOrderId: snapshot.cdekOrderId || cdekOrderUuid,
        trackingNumber: snapshot.trackingNumber || undefined
      }
    });

    await tx.orderShipmentStatusHistory.create({
      data: {
        shipmentId: shipment.id,
        status: nextStatus,
        payloadRaw: statusRaw
      }
    });

    return shipment;
  });

  return { shipment: updated, snapshot };
};

export const markReadyToShipCdek = async (orderId: string) => {
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true, variant: true } },
      buyer: true,
      contact: true
    }
  });

  if (!order) throw makeError('ORDER_NOT_FOUND');
  order = await normalizePvzProvider(order);

  if (order.status !== 'PAID' || !order.paidAt) throw makeError('ORDER_NOT_PAID');

  const fromPvzCode = String(order.sellerDropoffPvzId ?? '').trim();
  const toPvzCode = String(order.buyerPickupPvzId ?? '').trim();
  if (!fromPvzCode) throw makeError('CDEK_DROPOFF_PVZ_NOT_SET');
  if (!toPvzCode) throw makeError('CDEK_DESTINATION_PVZ_MISSING');

  const buyerProvider = parsePvzProvider(order.buyerPickupPvzMeta);
  if (buyerProvider && buyerProvider !== 'CDEK') {
    throw makeError('CDEK_DESTINATION_PVZ_PROVIDER_MISMATCH', `buyerPickupPvzMeta.provider must be CDEK for carrier CDEK (got ${buyerProvider})`);
  }

  const recipientName = String(order.recipientName ?? '').trim() || String(order.contact?.name ?? '').trim() || String(order.buyer?.name ?? '').trim() || 'Получатель';
  const recipientPhone = String(order.recipientPhone ?? '').trim() || String(order.contact?.phone ?? '').trim() || String(order.buyer?.phone ?? '').trim();
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
  const internalRequestId = randomUUID();
  const now = new Date();

  try {
    if (!CDEK_PVZ_CODE_REGEX.test(fromPvzCode)) throw makeError('CDEK_DROPOFF_PVZ_INVALID_FORMAT');
    if (!CDEK_PVZ_CODE_REGEX.test(toPvzCode)) throw makeError('CDEK_DESTINATION_PVZ_INVALID_FORMAT');

    const created = await cdekService.createOrderFromMarketplaceOrder({
      orderId: order.id,
      clientNumber: detectClientNumber(order),
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

    if (!created.cdekOrderId) throw makeError('CDEK_CREATE_ORDER_NO_UUID');

    const statusRaw = {
      cdek_order_uuid: created.cdekOrderId,
      cdek_request_uuid: created.cdekRequestUuid ?? '',
      cdek_state: created.state ?? '',
      trackingNumber: created.trackingNumber ?? ''
    };

    const shipment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nextShipment = await tx.orderShipment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          provider: 'CDEK',
          deliveryMethod: 'PICKUP_POINT',
          sourceStationId: fromPvzCode,
          destinationStationId: toPvzCode,
          requestId: internalRequestId,
          status: 'READY_TO_SHIP',
          statusRaw,
          lastSyncAt: now
        },
        update: {
          provider: 'CDEK',
          deliveryMethod: 'PICKUP_POINT',
          sourceStationId: fromPvzCode,
          destinationStationId: toPvzCode,
          requestId: internalRequestId,
          status: 'READY_TO_SHIP',
          statusRaw,
          lastSyncAt: now
        }
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          carrier: 'CDEK',
          cdekOrderId: created.cdekOrderId,
          cdekStatus: created.state || 'ACCEPTED',
          trackingNumber: created.trackingNumber || null,
          readyForShipmentAt: now,
          statusUpdatedAt: now
        }
      });

      await tx.orderShipmentStatusHistory.create({
        data: { shipmentId: nextShipment.id, status: 'READY_TO_SHIP', payloadRaw: statusRaw }
      });

      return nextShipment;
    });

    let synced: Awaited<ReturnType<typeof syncShipmentByOrder>> | null = null;
    try {
      synced = await syncShipmentByOrder(order.id);
    } catch (syncError) {
      console.warn('[CDEK][markReadyToShipCdek] immediate sync failed', { orderId: order.id, syncError });
    }

    return {
      shipment: synced?.shipment ?? shipment,
      cdek: {
        cdekOrderId: created.cdekOrderId,
        trackingNumber: synced?.snapshot.trackingNumber || created.trackingNumber,
        cdekRequestUuid: created.cdekRequestUuid,
        state: synced?.snapshot.status || created.state
      }
    };
  } catch (error) {
    console.error('[CDEK][markReadyToShipCdek] failed', { orderId: order.id, error });
    throw error;
  }
};

export const shipmentService = {
  ensure: ensureShipmentTables,
  normalizePvzProvider,
  isFinalStatus: (status: ShipmentInternalStatus) => FINAL_STATUSES.includes(status),

  getByOrderIds: async (orderIds: string[]): Promise<Map<string, OrderShipment>> => {
    await ensureShipmentTables();
    if (!orderIds.length) return new Map<string, OrderShipment>();

    const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, carrier: true, buyerPickupPvzId: true, buyerPickupPvzMeta: true } });
    await Promise.all(orders.map((order) => normalizePvzProvider(order as any)));

    const shipments = await prisma.orderShipment.findMany({ where: { orderId: { in: orderIds } } });
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

  readyToShipCdek: async (params: { orderId: string; sellerId: string }) => {
    void params.sellerId;
    return markReadyToShipCdek(params.orderId);
  },

  syncByShipmentId: async (shipmentId: string) => {
    const shipment = await prisma.orderShipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw makeError('SHIPMENT_NOT_FOUND');
    return syncShipmentByOrder(shipment.orderId);
  },

  syncByOrderId: async (orderId: string) => syncShipmentByOrder(orderId),

  getPrintableForms: async (orderId: string) => {
    const shipment = await prisma.orderShipment.findUnique({ where: { orderId } });
    if (!shipment) throw makeError('SHIPMENT_NOT_FOUND');

    const statusRaw = safeRecord(shipment.statusRaw);
    const printRaw = safeRecord(statusRaw.print);
    const waybillUrl = String(printRaw.waybillUrl ?? '').trim() || null;
    const barcodeUrls = Array.isArray(printRaw.barcodeUrls) ? printRaw.barcodeUrls.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [];

    return { waybillUrl, barcodeUrls, shipment };
  }
};

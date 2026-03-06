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

type ShipmentFormsStatus = 'NOT_REQUESTED' | 'FORMING' | 'READY';

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

const hasRealDocuments = (statusRaw: Record<string, unknown>) => {
  const print = safeRecord(statusRaw.print);
  const waybillUrl = String(print.waybillUrl ?? '').trim();
  const barcodeUrls = Array.isArray(print.barcodeUrls)
    ? print.barcodeUrls.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const relatedEntities = Array.isArray(statusRaw.related_entities) ? statusRaw.related_entities : [];
  return Boolean(waybillUrl || barcodeUrls.length || relatedEntities.length);
};

const evaluateSnapshotValidity = (snapshot: CdekOrderSnapshot) => {
  const requestState = String(snapshot.requestState ?? '').trim().toUpperCase();
  const requestErrors = Array.isArray(snapshot.requestErrors) ? snapshot.requestErrors : [];
  const hasRequestErrors = requestErrors.length > 0;
  const hasTracking = Boolean(String(snapshot.trackingNumber ?? '').trim());
  const hasDocs = Boolean(snapshot.relatedEntities.waybillUrl) || snapshot.relatedEntities.barcodeUrls.length > 0;
  const isInvalid = snapshot.isRequestInvalid || requestState === 'INVALID' || hasRequestErrors;

  return {
    isValid: !isInvalid,
    requestState,
    requestErrors,
    hasTracking,
    hasDocs,
    errorCode: requestErrors[0]?.code ?? (isInvalid ? 'CDEK_CREATE_INVALID' : ''),
    errorMessage: requestErrors[0]?.message ?? (isInvalid ? 'Ошибка оформления доставки в CDEK' : '')
  };
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

const parsePvzProvider = (meta: unknown) => String(safeRecord(meta).provider ?? '').trim().toUpperCase();

const normalizeDimensionCm = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? NaN)) return undefined;
  const rounded = Math.trunc(Number(value));
  if (rounded <= 0) return undefined;
  if (rounded > 100) {
    console.warn('[CDEK][createShipmentCdek] oversized dimension, fallback to default 10cm', { value: rounded });
    return 10;
  }
  return rounded;
};

const resolveRouteType = (order: Pick<Order, 'shippingAddressId' | 'buyerPickupPvzId' | 'sellerDropoffPvzId'>): 'PVZ_TO_PVZ' | 'DOOR_TO_DOOR' | 'DOOR_TO_PVZ' | 'PVZ_TO_DOOR' => {
  const hasSellerPvz = Boolean(String(order.sellerDropoffPvzId ?? '').trim());
  const hasBuyerPvz = Boolean(String(order.buyerPickupPvzId ?? '').trim());
  const hasBuyerDoor = Boolean(String(order.shippingAddressId ?? '').trim());

  if (hasSellerPvz && hasBuyerPvz) return 'PVZ_TO_PVZ';
  if (!hasSellerPvz && hasBuyerDoor) return 'DOOR_TO_DOOR';
  if (!hasSellerPvz && hasBuyerPvz) return 'DOOR_TO_PVZ';
  if (hasSellerPvz && hasBuyerDoor) return 'PVZ_TO_DOOR';
  return 'PVZ_TO_PVZ';
};



const hasTariffUnavailableError = (errors: Array<{ code?: string; message?: string }> | undefined) => {
  const first = errors?.[0];
  const code = String(first?.code ?? '').trim().toLowerCase();
  const message = String(first?.message ?? '').trim().toLowerCase();
  return code === 'err_result_service_empty' || message.includes('err_result_service_empty');
};
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

const buildStatusRaw = (snapshot: CdekOrderSnapshot, fallbackUuid: string, orderNumber: string) => ({
  cdek_order_number: orderNumber,
  cdek_order_uuid: snapshot.cdekOrderId || fallbackUuid,
  cdek_request_uuid: snapshot.requestUuid || '',
  cdek_state: snapshot.status || '',
  requestState: snapshot.requestState || '',
  requestErrors: snapshot.requestErrors ?? [],
  isValid: !snapshot.isRequestInvalid,
  trackingNumber: snapshot.trackingNumber || '',
  print: {
    waybillUrl: snapshot.relatedEntities.waybillUrl,
    barcodeUrls: snapshot.relatedEntities.barcodeUrls
  },
  related_entities: snapshot.raw.related_entities ?? []
});

const getFormsStatusFromRaw = (statusRaw: Record<string, unknown> | null | undefined): 'NOT_REQUESTED' | 'FORMING' | 'READY' => {
  const raw = statusRaw ?? {};
  if (raw.isValid === false) return 'NOT_REQUESTED';
  const explicit = String(raw.formsStatus ?? '').toUpperCase();
  if (explicit === 'READY' || explicit === 'FORMING' || explicit === 'NOT_REQUESTED') {
    return explicit as 'NOT_REQUESTED' | 'FORMING' | 'READY';
  }

  const printRaw = safeRecord(raw.print);
  const waybillUrl = String(printRaw.waybillUrl ?? '').trim();
  if (!waybillUrl && !hasRealDocuments(raw)) return 'NOT_REQUESTED';
  return waybillUrl ? 'READY' : 'FORMING';
};

const syncShipmentByOrder = async (orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) throw makeError('ORDER_NOT_FOUND');

  const cdekOrderUuid = String(order.cdekOrderId ?? '').trim() || String((order.shipment?.statusRaw as any)?.cdek_order_uuid ?? '').trim();
  if (!cdekOrderUuid) throw makeError('CDEK_ORDER_UUID_MISSING');

  const snapshot = await cdekService.getOrderByUuid(cdekOrderUuid);
  const validity = evaluateSnapshotValidity(snapshot);
  const nextStatus = validity.isValid ? mapExternalStatusToInternal(snapshot.status) : 'FAILED';
  const statusRaw = buildStatusRaw(snapshot, cdekOrderUuid, order.id);
  const previousRaw = safeRecord(order.shipment?.statusRaw);
  const previousManualSyncAt = previousRaw.lastManualSyncAt;
  const formsStatus: ShipmentFormsStatus = validity.isValid ? getFormsStatusFromRaw(statusRaw) : 'NOT_REQUESTED';
  const nextStatusRaw = {
    ...statusRaw,
    isValid: validity.isValid,
    errorCode: validity.errorCode,
    errorMessage: validity.errorMessage,
    formsStatus,
    ...(formsStatus === 'READY' ? { documentsReadyAt: new Date().toISOString() } : {}),
    ...(previousManualSyncAt ? { lastManualSyncAt: previousManualSyncAt } : {})
  };

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
        statusRaw: nextStatusRaw,
        lastSyncAt: new Date()
      },
      update: {
        requestId: snapshot.requestUuid || undefined,
        status: nextStatus,
        statusRaw: nextStatusRaw,
        lastSyncAt: new Date()
      }
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        cdekStatus: snapshot.status || undefined,
        cdekOrderId: snapshot.cdekOrderId || cdekOrderUuid,
        trackingNumber: validity.isValid ? (snapshot.trackingNumber || undefined) : null,
        ...(validity.isValid ? {} : { status: 'READY_FOR_SHIPMENT' as any })
      }
    });

    await tx.orderShipmentStatusHistory.create({
      data: {
        shipmentId: shipment.id,
        status: nextStatus,
        payloadRaw: nextStatusRaw
      }
    });

    return shipment;
  });

  return { shipment: updated, snapshot };
};

const loadOrderForCdekShipment = async (orderId: string, sellerId?: string) => {
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true, variant: true } },
      buyer: true,
      contact: true
    }
  });

  if (!order) throw makeError('ORDER_NOT_FOUND');
  if (sellerId) {
    const hasAccess = order.items.some((item) => item.product.sellerId === sellerId);
    if (!hasAccess) throw makeError('ORDER_NOT_FOUND');
  }
  order = await normalizePvzProvider(order);

  const latestPayment = await prisma.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
    select: { status: true }
  });
  const isPaid = Boolean(order.paidAt) || latestPayment?.status === 'SUCCEEDED';
  if (!isPaid) throw makeError('ORDER_NOT_PAID');
  const fulfillment = order as Order & { isPacked?: boolean };
  if (!fulfillment.isPacked) {
    throw makeError('FULFILLMENT_STEPS_INCOMPLETE', 'Перед отгрузкой отметьте: Упаковка.');
  }

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
  const routeType = resolveRouteType(order);
  const lengthCm = normalizeDimensionCm(firstProduct?.dxCm);
  const widthCm = normalizeDimensionCm(firstProduct?.dyCm);
  const heightCm = normalizeDimensionCm(firstProduct?.dzCm);

  return {
    order,
    fromPvzCode,
    toPvzCode,
    recipientName,
    recipientPhone,
    items,
    totalWeight,
    firstProduct,
    routeType,
    lengthCm,
    widthCm,
    heightCm
  };
};

export const createShipmentCdek = async (orderId: string, sellerId?: string) => {
  const {
    order,
    fromPvzCode,
    toPvzCode,
    recipientName,
    recipientPhone,
    items,
    totalWeight,
    firstProduct,
    routeType,
    lengthCm,
    widthCm,
    heightCm
  } = await loadOrderForCdekShipment(orderId, sellerId);

  const existingShipment = await prisma.orderShipment.findUnique({ where: { orderId: order.id } });
  if (existingShipment || order.cdekOrderId) {
    return {
      shipment: existingShipment,
      cdek: {
        cdekOrderId: order.cdekOrderId,
        trackingNumber: order.trackingNumber,
        cdekRequestUuid: null,
        state: order.cdekStatus
      }
    };
  }

  const internalRequestId = randomUUID();
  const now = new Date();

  try {
    if (!CDEK_PVZ_CODE_REGEX.test(fromPvzCode)) throw makeError('CDEK_DROPOFF_PVZ_INVALID_FORMAT');
    if (!CDEK_PVZ_CODE_REGEX.test(toPvzCode)) throw makeError('CDEK_DESTINATION_PVZ_INVALID_FORMAT');

    console.info('[CDEK][createShipmentCdek][input]', {
      orderId: order.id,
      routeType,
      fromPvzCode,
      toPvzCode,
      weightGrams: totalWeight > 0 ? totalWeight : 500,
      dimensionsCm: {
        length: lengthCm ?? 10,
        width: widthCm ?? 10,
        height: heightCm ?? 10,
        rawLength: firstProduct?.dxCm,
        rawWidth: firstProduct?.dyCm,
        rawHeight: firstProduct?.dzCm
      }
    });

    const created = await cdekService.createOrderFromMarketplaceOrder({
      orderId: order.id,
      fromPvzCode,
      toPvzCode,
      routeType,
      recipientName,
      recipientPhone,
      items,
      comment: `Order ${order.id}`,
      weightGrams: totalWeight > 0 ? totalWeight : undefined,
      lengthCm,
      widthCm,
      heightCm
    });

    const isValid = !created.isRequestInvalid;

    if (!created.cdekOrderId && isValid) throw makeError('CDEK_CREATE_ORDER_NO_UUID');

    const statusRaw = {
      cdek_order_number: order.id,
      cdek_order_uuid: created.cdekOrderId ?? '',
      cdek_request_uuid: created.cdekRequestUuid ?? '',
      cdek_state: created.state ?? '',
      requestState: created.requestState ?? '',
      requestErrors: created.requestErrors ?? [],
      isValid,
      errorCode: created.requestErrors?.[0]?.code ?? (created.requestState === 'INVALID' ? 'CDEK_TARIFF_UNAVAILABLE' : ''),
      errorMessage: created.requestErrors?.[0]?.message ?? '',
      trackingNumber: created.trackingNumber ?? '',
      formsStatus: isValid ? 'FORMING' : 'NOT_REQUESTED',
      routeType,
      tariffCode: created.tariffCode ?? null
    };

    if (!isValid && hasTariffUnavailableError(created.requestErrors as Array<{ code?: string; message?: string }>)) {
      throw makeError('CDEK_TARIFF_UNAVAILABLE', created.requestErrors?.[0]?.message ?? 'Тариф CDEK недоступен для выбранного направления.');
    }

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
          status: isValid ? 'READY_TO_SHIP' : 'FAILED',
          statusRaw,
          lastSyncAt: now
        },
        update: {
          provider: 'CDEK',
          deliveryMethod: 'PICKUP_POINT',
          sourceStationId: fromPvzCode,
          destinationStationId: toPvzCode,
          requestId: internalRequestId,
          status: isValid ? 'READY_TO_SHIP' : 'FAILED',
          statusRaw,
          lastSyncAt: now
        }
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          carrier: 'CDEK',
          cdekOrderId: created.cdekOrderId || null,
          cdekStatus: created.state || null,
          trackingNumber: isValid ? (created.trackingNumber || null) : null,
          ...(isValid ? {} : { status: 'READY_FOR_SHIPMENT' as any })
        }
      });

      await tx.orderShipmentStatusHistory.create({
        data: { shipmentId: nextShipment.id, status: isValid ? 'READY_TO_SHIP' : 'FAILED', payloadRaw: statusRaw }
      });

      return nextShipment;
    });

    if (!isValid) {
      return {
        shipment,
        cdek: {
          cdekOrderId: created.cdekOrderId,
          trackingNumber: null,
          cdekRequestUuid: created.cdekRequestUuid,
          state: created.state,
          errorCode: created.requestErrors?.[0]?.code ?? 'CDEK_TARIFF_UNAVAILABLE',
          errorMessage: created.requestErrors?.[0]?.message ?? 'Ошибка оформления доставки в CDEK'
        }
      };
    }

    return {
      shipment,
      cdek: {
        cdekOrderId: created.cdekOrderId,
        trackingNumber: created.trackingNumber,
        cdekRequestUuid: created.cdekRequestUuid,
        state: created.state
      }
    };
  } catch (error) {
    console.error('[CDEK][createShipmentCdek] failed', { orderId: order.id, error });
    throw error;
  }
};

export const markReadyToShipCdek = async (orderId: string, sellerId?: string) => {
  const { order } = await loadOrderForCdekShipment(orderId, sellerId);

  const existingShipment = await prisma.orderShipment.findUnique({ where: { orderId: order.id } });
  let cdekOrderId = String(order.cdekOrderId ?? '').trim() || null;
  let trackingNumber = order.trackingNumber;
  let cdekState = order.cdekStatus;

  if (!existingShipment || !cdekOrderId) {
    const created = await createShipmentCdek(orderId, sellerId);
    cdekOrderId = created.cdek.cdekOrderId ?? cdekOrderId;
    trackingNumber = created.cdek.trackingNumber ?? trackingNumber;
    cdekState = created.cdek.state ?? cdekState;
  }

  const shipmentForOrder = await prisma.orderShipment.findUnique({ where: { orderId: order.id } });
  if (!shipmentForOrder || !cdekOrderId) {
    throw makeError('SHIPMENT_NOT_FOUND', 'Сначала нажмите «Готов к отгрузке».');
  }

  if (shipmentForOrder.status === 'FAILED') {
    const statusRaw = safeRecord(shipmentForOrder.statusRaw);
    const errorCode = String(statusRaw.errorCode ?? '').trim().toLowerCase();
    if (errorCode === 'err_result_service_empty' || errorCode === 'cdek_tariff_unavailable') {
      throw makeError('CDEK_TARIFF_UNAVAILABLE');
    }
    throw makeError('CDEK_SHIPMENT_INVALID', 'Ошибка оформления доставки. Тариф CDEK недоступен для выбранного направления.');
  }

  const now = new Date();

  const shipment = await prisma.$transaction(async (tx) => {
    const currentStatusRaw = safeRecord(shipmentForOrder.statusRaw);
    const nextShipment = await tx.orderShipment.update({
      where: { id: shipmentForOrder.id },
      data: {
        status: 'READY_TO_SHIP',
        statusRaw: {
          ...currentStatusRaw,
          formsStatus: 'FORMING',
          documentsReadyAt: null,
          lastManualSyncAt: null
        },
        lastSyncAt: now
      }
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        readyForShipmentAt: now,
        status: 'HANDED_TO_DELIVERY' as any,
        statusUpdatedAt: now,
        cdekOrderId: cdekOrderId,
        cdekStatus: cdekState || undefined,
        trackingNumber: trackingNumber || undefined
      }
    });

    await tx.orderShipmentStatusHistory.create({
      data: { shipmentId: nextShipment.id, status: 'READY_TO_SHIP', payloadRaw: { source: 'seller-ready-to-ship' } }
    });

    return nextShipment;
  });

  return {
    shipment,
    cdek: {
      cdekOrderId,
      trackingNumber,
      cdekRequestUuid: null,
      state: cdekState
    }
  };
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
    return markReadyToShipCdek(params.orderId, params.sellerId);
  },

  createShipmentCdek: async (params: { orderId: string; sellerId: string }) => {
    return createShipmentCdek(params.orderId, params.sellerId);
  },

  syncByShipmentId: async (shipmentId: string) => {
    const shipment = await prisma.orderShipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw makeError('SHIPMENT_NOT_FOUND');
    const synced = await syncShipmentByOrder(shipment.orderId);
    const statusRaw = safeRecord(synced.shipment.statusRaw);
    const nextStatusRaw = {
      ...statusRaw,
      lastManualSyncAt: new Date().toISOString()
    };

    const updatedShipment = await prisma.orderShipment.update({
      where: { id: synced.shipment.id },
      data: { statusRaw: nextStatusRaw }
    });

    return {
      ...synced,
      shipment: updatedShipment
    };
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

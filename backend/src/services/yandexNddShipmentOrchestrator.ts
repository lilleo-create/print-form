import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { orderDeliveryService } from './orderDeliveryService';
import { mapYandexStatusToInternal, shipmentService } from './shipmentService';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';
import { getOperatorStationId, normalizeDigitsStation } from './yandexNdd/getOperatorStationId';
import { resolveOperatorStationIdByPickupPointId } from './yandexNdd/resolveOperatorStationIdByPickupPointId';

const readyToShipSingleFlight = new Map<string, Promise<any>>();

const pickBestOffer = (response: Record<string, unknown>) => {
  const offers = (response.offers as Record<string, unknown>[] | undefined) ?? [];
  if (!offers.length) return null;
  const sorted = [...offers].sort((a, b) => {
    const priceA = Number(
      (a.price as Record<string, unknown> | undefined)?.amount ?? Number.MAX_SAFE_INTEGER
    );
    const priceB = Number(
      (b.price as Record<string, unknown> | undefined)?.amount ?? Number.MAX_SAFE_INTEGER
    );
    return priceA - priceB;
  });
  return sorted[0];
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const getTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const extractBuyerPickupStationIdRaw = (meta: unknown): string | null => {
  const direct = asRecord(meta);
  const raw = asRecord(direct?.raw);
  return (
    getTrimmedString(raw?.buyerPickupStationId) ??
    getTrimmedString(raw?.operator_station_id) ??
    null
  );
};

const extractYandexStatus = (payload: Record<string, unknown>) => {
  const status =
    (payload.status as string | undefined) ??
    ((payload.request as Record<string, unknown> | undefined)?.status as string | undefined) ??
    (((payload.history as Record<string, unknown>[] | undefined) ?? [])[Math.max(
      (((payload.history as Record<string, unknown>[] | undefined) ?? []).length - 1),
      0
    )]?.status as string | undefined);
  return status ?? null;
};

const extractIntervalUtc = (
  offersInfo: Record<string, unknown>
): { from: number | string; to: number | string } | null => {
  const candidates: unknown[] = [
    (offersInfo as any).interval_utc,
    (offersInfo as any).intervals_utc,
    (offersInfo as any).intervals,
    (offersInfo.result as Record<string, unknown> | undefined)?.interval_utc,
    (offersInfo.result as Record<string, unknown> | undefined)?.intervals_utc,
    (offersInfo.result as Record<string, unknown> | undefined)?.intervals,
    (offersInfo.payload as Record<string, unknown> | undefined)?.interval_utc,
    (offersInfo.payload as Record<string, unknown> | undefined)?.intervals_utc,
    (offersInfo.payload as Record<string, unknown> | undefined)?.intervals
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === 'object') {
      const first = candidate[0] as Record<string, unknown>;
      if (first.from && first.to) return { from: first.from as string | number, to: first.to as string | number };
    }

    if (typeof candidate === 'object' && !Array.isArray(candidate)) {
      const interval = candidate as Record<string, unknown>;
      if (interval.from && interval.to) return { from: interval.from as string | number, to: interval.to as string | number };
    }
  }

  return null;
};


const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const parseRecipientName = (order: any) => {
  const rawName =
    order.recipientName ??
    order.contact?.name ??
    order.buyer?.name ??
    'Покупатель';
  const normalized = String(rawName).trim();
  const [firstName = 'Покупатель', ...rest] = normalized.split(/\s+/);
  const lastName = rest.join(' ') || '-';
  return { firstName, lastName };
};

const buildPhysicalDims = (item: any) => {
  if (item.product?.weightGrossG) {
    return {
      weight_gross: item.product.weightGrossG,
      dx: item.product?.dxCm ?? undefined,
      dy: item.product?.dyCm ?? undefined,
      dz: item.product?.dzCm ?? undefined
    };
  }
  return { predefined_volume: 1 };
};

const findOfferId = (
  offersResponse: Record<string, unknown>,
  selectedOffer: Record<string, unknown> | null
) => {
  return (
    (offersResponse.offer_id as string | undefined) ??
    ((offersResponse.offer as Record<string, unknown> | undefined)?.offer_id as string | undefined) ??
    (selectedOffer?.offer_id as string | undefined) ??
    null
  );
};

export const yandexNddShipmentOrchestrator = {
  readyToShip: async (sellerId: string, orderId: string) => {
    const inFlight = readyToShipSingleFlight.get(orderId);
    if (inFlight) {
      return inFlight;
    }

    const runPromise = (async () => {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: { some: { product: { sellerId } } }
      },
      select: {
        id: true,
        status: true,
        paidAt: true,
        sellerDropoffPvzId: true,
        sellerDropoffPvzMeta: true,
        buyerPickupPvzId: true,
        buyerPickupPvzMeta: true,
        recipientName: true,
        recipientPhone: true,
        contact: true,
        buyer: true,
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'PAID' || !order.paidAt) throw new Error('ORDER_NOT_PAID');
    if (!order.buyerPickupPvzId) throw new Error('PICKUP_POINT_REQUIRED');

    const deliveryMap = await orderDeliveryService.getByOrderIds([orderId]);
    const delivery = deliveryMap.get(orderId);
    const deliveryMethod = 'PICKUP_POINT';

    const existing = await shipmentService.getByOrderId(orderId);
    if (existing?.requestId) {
      return existing;
    }

    const sellerDeliveryProfile = await prisma.sellerDeliveryProfile.findUnique({
      where: { sellerId },
      select: { dropoffStationId: true, dropoffStationMeta: true }
    });

    console.info('[READY_TO_SHIP][ctx]', {
      sellerId,
      orderId,
      orderSellerDropoffPvzId: (order as any).sellerDropoffPvzId,
      hasSellerProfile: Boolean(sellerDeliveryProfile),
      sellerProfileDropoffStationId: sellerDeliveryProfile?.dropoffStationId ?? null
    });

    const profileDropoffRaw = sellerDeliveryProfile?.dropoffStationId?.trim() || null;
    const profileMeta =
      sellerDeliveryProfile?.dropoffStationMeta && typeof sellerDeliveryProfile.dropoffStationMeta === 'object'
        ? (sellerDeliveryProfile.dropoffStationMeta as Record<string, unknown>)
        : null;
    const fromProfileId = normalizeDigitsStation(profileDropoffRaw);
    const fromProfileMetaRaw = getOperatorStationId(profileMeta);

    const sourceStationId = fromProfileId ?? fromProfileMetaRaw;
    const sourceStationFrom: 'profile.dropoffStationId' | 'profile.meta.operator_station_id' | 'none' = fromProfileId
      ? 'profile.dropoffStationId'
      : fromProfileMetaRaw
        ? 'profile.meta.operator_station_id'
        : 'none';

    console.info('[READY_TO_SHIP] station resolved', { sourceStationId, from: sourceStationFrom });

    if (!sourceStationId) {
      console.error('[READY_TO_SHIP] SELLER_STATION_ID_REQUIRED', {
        sellerId,
        orderId,
        profileDropoffRaw,
        fromProfileMetaRaw,
        fromProfileId,
        nodeEnv: process.env.NODE_ENV
      });
      throw new Error('SELLER_STATION_ID_REQUIRED');
    }

    const buyerPickupPointId = String(order.buyerPickupPvzId ?? '').trim();
    let buyerPickupMeta = asRecord(order.buyerPickupPvzMeta) ?? {};
    let buyerPickupStationIdRaw = extractBuyerPickupStationIdRaw(buyerPickupMeta);

    if (!buyerPickupStationIdRaw && ['PAID', 'READY_TO_SHIP'].includes(order.status)) {
      const backfilledStationId = await resolveOperatorStationIdByPickupPointId(buyerPickupPointId);
      if (backfilledStationId) {
        const rawMeta = asRecord(buyerPickupMeta.raw) ?? {};
        const nextRawMeta = {
          ...rawMeta,
          id: buyerPickupPointId,
          buyerPickupPointId,
          buyerPickupStationId: backfilledStationId
        };
        buyerPickupMeta = {
          ...buyerPickupMeta,
          buyerPickupStationId: backfilledStationId,
          raw: nextRawMeta
        };
        await prisma.order.update({
          where: { id: order.id },
          data: {
            buyerPickupPvzMeta: buyerPickupMeta as Prisma.InputJsonValue
          }
        });
        buyerPickupStationIdRaw = backfilledStationId;
        console.info('[READY_TO_SHIP] BUYER_STATION_ID_BACKFILLED', {
          orderId: order.id,
          buyerPickupPvzId: buyerPickupPointId,
          buyerPickupStationId: backfilledStationId
        });
      }
    }

    if (!buyerPickupStationIdRaw) {
      const error = new Error('BUYER_STATION_ID_REQUIRED');
      (error as Error & { details?: Record<string, string> }).details = {
        orderId: order.id,
        buyerPickupPvzId: buyerPickupPointId
      };
      throw error;
    }
    const selfPickupId = buyerPickupStationIdRaw;

    console.info('[READY_TO_SHIP] ids', {
      buyerPickupPointId,
      buyerPickupStationId: selfPickupId,
      sellerDropoffStationId: sourceStationId
    });

    if (!/^\d+$/.test(sourceStationId) || !/^\d+$/.test(selfPickupId)) {
      throw new Error('VALIDATION_ERROR');
    }

    if (isUuidLike(selfPickupId) && selfPickupId === sourceStationId) {
      throw new Error('ID_TYPE_MISMATCH');
    }

    if (sourceStationId === buyerPickupPointId) {
      throw new Error('STATION_ID_EQUALS_PICKUP_POINT_ID');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD readyToShip stations]', {
        orderId,
        station_id: sourceStationId,
        self_pickup_id: selfPickupId,
        source: sourceStationFrom
      });
    }

    console.info('[NDD] using ids', {
      station_id: sourceStationId,
      self_pickup_id: selfPickupId,
      source_fields: {
        seller: sourceStationFrom,
        buyer: 'buyerPickupPvzMeta.raw.buyerPickupStationId'
      }
    });

    let offersInfo: Record<string, unknown>;
    try {
      offersInfo = await yandexNddClient.offersInfo(
        sourceStationId,
        selfPickupId,
        'time_interval',
        true
      );
    } catch (error) {
      if (error instanceof YandexNddHttpError && error.code === 'YANDEX_SMARTCAPTCHA_BLOCK') {
        const details =
          error.details && typeof error.details === 'object'
            ? (error.details as Record<string, unknown>)
            : {};
        console.warn('[NDD] blocked by SmartCaptcha', {
          uniqueKey: typeof details.uniqueKey === 'string' ? details.uniqueKey : undefined
        });
        throw new YandexNddHttpError('YANDEX_IP_BLOCKED', error.path, error.status, error.raw, error.details);
      }
      throw error;
    }
    const intervalUtc = extractIntervalUtc(offersInfo);
    if (!intervalUtc) {
      throw new Error('NDD_INTERVAL_REQUIRED');
    }

    const barcode = `PF-${order.id}`;
    const recipient = parseRecipientName(order);
    const recipientPhone = order.recipientPhone ?? order.contact?.phone ?? order.buyer?.phone;
    if (!recipientPhone) {
      throw new Error('RECIPIENT_PHONE_REQUIRED');
    }

    const items = order.items.map((item: any) => ({
      count: item.quantity,
      name: item.product.title,
      article: item.variant?.sku ?? item.product.sku,
      billing_details: {
        unit_price: item.priceAtPurchase,
        assessed_unit_price: item.priceAtPurchase
      },
      physical_dims: buildPhysicalDims(item),
      place_barcode: barcode
    }));

    const totalWeight = order.items.reduce(
      (sum: number, item: any) => sum + ((item.product?.weightGrossG ?? 0) * item.quantity),
      0
    );

    const offersBody: Record<string, unknown> = {
      station_id: sourceStationId,
      self_pickup_id: selfPickupId,
      interval_utc: intervalUtc,
      last_mile_policy: 'time_interval',
      info: {
        operator_request_id: order.id
      },
      items,
      places: [
        {
          barcode,
          description: `Order ${order.id}`,
          physical_dims: totalWeight > 0 ? { weight_gross: totalWeight } : { predefined_volume: 1 }
        }
      ],
      recipient_info: {
        first_name: recipient.firstName,
        last_name: recipient.lastName,
        phone: recipientPhone
      },
      billing_info: {
        payment_method: 'already_paid'
      }
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD readyToShip offers/create body]', JSON.stringify(offersBody));
    }

    const offersResponse = await yandexNddClient.offersCreate(offersBody);
    const selectedOffer = pickBestOffer(offersResponse);
    const selectedOfferId = findOfferId(offersResponse, selectedOffer);

    if (!selectedOfferId) {
      await shipmentService.upsertForOrder({
        orderId,
        deliveryMethod,
        sourceStationId,
        sourceStationSnapshot: asRecord(order.sellerDropoffPvzMeta),
        destinationStationId: order.buyerPickupPvzId,
        destinationStationSnapshot: delivery?.pickupPoint ?? asRecord(order.buyerPickupPvzMeta),
        status: 'CREATED',
        statusRaw: {
          offersInfo,
          offersCreate: offersResponse
        }
      });
      throw new Error('NDD_OFFERS_EMPTY');
    }

    const offersConfirmResponse = await yandexNddClient.offersConfirm({ offer_id: selectedOfferId });
    let requestId =
      (offersConfirmResponse.request_id as string | undefined) ??
      ((offersConfirmResponse.request as Record<string, unknown> | undefined)?.request_id as string | undefined) ??
      null;

    let requestCreateResponse: Record<string, unknown> | null = null;
    if (!requestId) {
      requestCreateResponse = await yandexNddClient.requestCreate({ offer_id: selectedOfferId });
      requestId =
        (requestCreateResponse.request_id as string | undefined) ??
        ((requestCreateResponse.request as Record<string, unknown> | undefined)?.request_id as string | undefined) ??
        null;
    }

    if (!requestId) {
      throw new Error('NDD_REQUEST_ID_MISSING');
    }

    const yandexStatus = extractYandexStatus(offersConfirmResponse) ?? 'CREATED';
    const internalStatus = mapYandexStatusToInternal(yandexStatus);
    const statusRaw = {
      yandex: offersConfirmResponse,
      offersInfo,
      offersCreate: offersResponse,
      offersConfirm: offersConfirmResponse,
      requestCreate: requestCreateResponse,
      lastStatus: yandexStatus,
      offerId: selectedOfferId
    };

    const updated = await shipmentService.upsertForOrder({
      orderId,
      deliveryMethod,
      sourceStationId,
      sourceStationSnapshot: asRecord(order.sellerDropoffPvzMeta),
      destinationStationId: order.buyerPickupPvzId,
      destinationStationSnapshot: delivery?.pickupPoint ?? asRecord(order.buyerPickupPvzMeta),
      requestId,
      offerPayload: JSON.stringify(selectedOffer ?? { offer_id: selectedOfferId }),
      status: internalStatus,
      statusRaw
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'READY_FOR_SHIPMENT',
        statusUpdatedAt: new Date(),
        readyForShipmentAt: new Date(),
        dropoffDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    await shipmentService.pushHistory(updated.id, internalStatus, statusRaw);
    return updated;
    })();

    readyToShipSingleFlight.set(orderId, runPromise);

    try {
      return await runPromise;
    } finally {
      readyToShipSingleFlight.delete(orderId);
    }
  },

  syncStatuses: async () => {
    const shipments = await shipmentService.listForSync();
    let changed = 0;

    for (const shipment of shipments) {
      if (!shipment.requestId) continue;

      const history = await yandexNddClient.requestHistory(shipment.requestId);
      const yandexStatus =
        extractYandexStatus(history) ??
        extractYandexStatus(await yandexNddClient.requestInfo(shipment.requestId));

      const internalStatus = mapYandexStatusToInternal(yandexStatus);
      const previousStatus = shipment.status;

      const statusRaw = {
        ...(shipment.statusRaw ?? {}),
        history,
        lastStatus: yandexStatus,
        syncedAt: new Date().toISOString()
      };

      const updated = await shipmentService.upsertForOrder({
        orderId: shipment.orderId,
        deliveryMethod: shipment.deliveryMethod,
        sourceStationId: shipment.sourceStationId,
        sourceStationSnapshot: shipment.sourceStationSnapshot ?? undefined,
        destinationStationId: shipment.destinationStationId,
        destinationStationSnapshot: shipment.destinationStationSnapshot ?? undefined,
        requestId: shipment.requestId,
        offerPayload: shipment.offerPayload,
        status: internalStatus,
        statusRaw,
        lastSyncAt: new Date()
      });

      if (previousStatus !== internalStatus) {
        changed += 1;
        await shipmentService.pushHistory(updated.id, internalStatus, statusRaw);
      }
    }

    return { total: shipments.length, changed };
  },

  generateLabel: async (orderId: string) => {
    const shipment = await shipmentService.getByOrderId(orderId);
    if (!shipment?.requestId) {
      throw new Error('SHIPMENT_REQUEST_NOT_FOUND');
    }

    const response = await yandexNddClient.generateLabels([shipment.requestId]);
    const base64Pdf = (response.pdf as string | undefined) ?? (response.content as string | undefined) ?? null;
    const url = (response.url as string | undefined) ?? null;

    return {
      shipment,
      url,
      pdfBuffer: base64Pdf ? Buffer.from(base64Pdf, 'base64') : null,
      raw: response
    };
  }
};

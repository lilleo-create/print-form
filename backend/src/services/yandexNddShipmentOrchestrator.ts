import { prisma } from '../lib/prisma';
import { orderDeliveryService } from './orderDeliveryService';
import { mapYandexStatusToInternal, shipmentService } from './shipmentService';
import { yandexNddClient } from './yandexNdd/YandexNddClient';
import { getOperatorStationId, normalizeStationId } from './yandexNdd/getOperatorStationId';

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
    if (!order.sellerDropoffPvzId || !order.buyerPickupPvzId) throw new Error('PICKUP_POINT_REQUIRED');

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

    if (process.env.NODE_ENV !== 'production') {
      console.log('[READY_TO_SHIP][ctx]', {
        sellerId,
        orderId,
        orderSellerDropoffPvzId: (order as any).sellerDropoffPvzId,
        hasSellerProfile: Boolean(sellerDeliveryProfile),
        sellerProfileDropoffStationId: sellerDeliveryProfile?.dropoffStationId ?? null
      });
    }

    const fromOrderRaw = getOperatorStationId((order.sellerDropoffPvzMeta as Record<string, unknown> | null)?.raw);
    const fromOrderMeta = getOperatorStationId(order.sellerDropoffPvzMeta);
    const fromProfileRaw = getOperatorStationId((sellerDeliveryProfile?.dropoffStationMeta as Record<string, unknown> | null)?.raw);
    const fromProfileMeta = getOperatorStationId(sellerDeliveryProfile?.dropoffStationMeta);
    const profileDropoffRaw = sellerDeliveryProfile?.dropoffStationId?.trim() || null;
    const fromProfileId = normalizeStationId(profileDropoffRaw);
    const profileDropoffLooksLikePvz = Boolean(profileDropoffRaw && !fromProfileId);

    const candidates: Array<{ value: string | null; source: 'order.meta.raw' | 'order.meta' | 'profile.meta.raw' | 'profile.meta' | 'profile.dropoffStationId' }> = [
      { value: fromOrderRaw, source: 'order.meta.raw' },
      { value: fromOrderMeta, source: 'order.meta' },
      { value: fromProfileRaw, source: 'profile.meta.raw' },
      { value: fromProfileMeta, source: 'profile.meta' },
      { value: fromProfileId, source: 'profile.dropoffStationId' }
    ];

    console.info('[READY_TO_SHIP] station candidates', {
      fromOrderRaw,
      fromOrderMeta,
      fromProfileRaw,
      fromProfileMeta,
      profileDropoffRaw,
      fromProfileId,
      profileDropoffLooksLikePvz
    });

    let sourceStationId: string | null = null;
    let sourceStationFrom: 'order.meta.raw' | 'order.meta' | 'profile.meta.raw' | 'profile.meta' | 'profile.dropoffStationId' | 'none' = 'none';

    for (const candidate of candidates) {
      if (candidate.value) {
        sourceStationId = candidate.value;
        sourceStationFrom = candidate.source;
        break;
      }
    }

    if (!sourceStationId) {
      console.error('[READY_TO_SHIP] SELLER_STATION_ID_REQUIRED', {
        sellerId,
        orderId,
        fromOrderRaw,
        fromOrderMeta,
        fromProfileRaw,
        fromProfileMeta,
        profileDropoffRaw,
        fromProfileId,
        profileDropoffLooksLikePvz
      });
      if (profileDropoffLooksLikePvz) {
        console.error('[READY_TO_SHIP] dropoffStationId is present but not a valid station_id/platform_station_id');
      }
      throw new Error('SELLER_STATION_ID_REQUIRED');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD readyToShip stations]', {
        orderId,
        station_id: sourceStationId,
        self_pickup_id: order.buyerPickupPvzId,
        source: sourceStationFrom
      });
    }

    console.info('[NDD] using station_id', {
      station_id: sourceStationId,
      self_pickup_id: order.buyerPickupPvzId,
      source: sourceStationFrom
    });

    const offersInfo = await yandexNddClient.offersInfo(
      sourceStationId,
      order.buyerPickupPvzId,
      'time_interval',
      true
    );
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
      self_pickup_id: order.buyerPickupPvzId,
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

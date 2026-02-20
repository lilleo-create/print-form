import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { orderDeliveryService } from './orderDeliveryService';
import { mapYandexStatusToInternal, shipmentService } from './shipmentService';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';
import { assertStationAndPvzPair, isDigitsStationId, isUuid, NddValidationError } from './yandexNdd/nddIdSemantics';
import { getYandexNddConfig } from '../config/yandexNdd';
import { yandexDeliveryService } from './yandexDeliveryService';

const readyToShipSingleFlight = new Map<string, Promise<any>>();

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const getTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const pickBestOffer = (offers: Record<string, unknown>[]) => {
  if (!offers.length) return null;
  const sorted = [...offers].sort((a, b) => {
    const priceA = Number((a.price as any)?.amount ?? Number.MAX_SAFE_INTEGER);
    const priceB = Number((b.price as any)?.amount ?? Number.MAX_SAFE_INTEGER);
    return priceA - priceB;
  });
  return sorted[0] ?? null;
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

const parseRecipientName = (order: any) => {
  const rawName = order.recipientName ?? order.contact?.name ?? order.buyer?.name ?? 'Покупатель';
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

export const yandexNddShipmentOrchestrator = {
  readyToShip: async (sellerId: string, orderId: string) => {
    const inFlight = readyToShipSingleFlight.get(orderId);
    if (inFlight) return inFlight;

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

      const buyerPickupPointId = String(order.buyerPickupPvzId ?? '').trim();
      if (!buyerPickupPointId) throw new NddValidationError('BUYER_SELF_PICKUP_ID_REQUIRED', 'buyerPickupPvzId is required.', 409);
      if (!isUuid(buyerPickupPointId)) {
        throw new NddValidationError('NDD_VALIDATION_ERROR', 'buyerPickupPvzId must be uuid self_pickup_id.', 400, { field: 'buyerPickupPvzId' });
      }

      const deliveryMap = await orderDeliveryService.getByOrderIds([orderId]);
      const delivery = deliveryMap.get(orderId);
      const deliveryMethod = 'PICKUP_POINT';

      const existing = await shipmentService.getByOrderId(orderId);
      if (existing?.requestId) return existing;

      const sellerDeliveryProfile = await prisma.sellerDeliveryProfile.findUnique({
        where: { sellerId },
        select: {
          dropoffPvzId: true,
          dropoffOperatorStationId: true, // ✅ digits
          dropoffPlatformStationId: true, // может быть uuid/что угодно, но нам НЕ нужно
          dropoffStationMeta: true
        }
      });

      const config = getYandexNddConfig();
      const sourceStationIdRaw = getTrimmedString(sellerDeliveryProfile?.dropoffOperatorStationId);

      console.info('[READY_TO_SHIP][ctx]', {
        sellerId,
        orderId,
        self_pickup_id: buyerPickupPointId,
        self_pickup_id_type: isUuid(buyerPickupPointId) ? 'uuid' : typeof buyerPickupPointId,
        hasSellerProfile: Boolean(sellerDeliveryProfile),
        dropoffOperatorStationId: sellerDeliveryProfile?.dropoffOperatorStationId ?? null,
        dropoffPlatformStationId: sellerDeliveryProfile?.dropoffPlatformStationId ?? null,
        nddEnabled: config.enabled,
        nddBaseUrl: config.baseUrl
      });

      if (!config.enabled) {
        throw new NddValidationError('NDD_REQUEST_FAILED', 'NDD is disabled: missing token.', 502);
      }

      if (!sourceStationIdRaw || !isDigitsStationId(sourceStationIdRaw)) {
        throw new NddValidationError(
          'SELLER_STATION_ID_REQUIRED',
          'Seller dropoff station_id (digits) is required. Select a dropoff PVZ that provides operator_station_id.',
          409
        );
      }

      const validatedPair = assertStationAndPvzPair(sourceStationIdRaw, buyerPickupPointId);
      const sourceStationId = validatedPair.stationId;
      const selfPickupId = validatedPair.selfPickupId;

      // ✅ Собираем тело строго под /offers/create (старый NDD platform API)
      const barcode = `PF-${order.id}`;
      const recipient = parseRecipientName(order);
      const recipientPhone = order.recipientPhone ?? order.contact?.phone ?? order.buyer?.phone;
      if (!recipientPhone) throw new Error('RECIPIENT_PHONE_REQUIRED');

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
        station_id: sourceStationId, // ✅ digits
        self_pickup_id: selfPickupId, // ✅ uuid
        payment_method: 'already_paid',
        places: [
          {
            barcode,
            description: `Order ${order.id}`,
            physical_dims: totalWeight > 0 ? { weight_gross: totalWeight } : { predefined_volume: 1 }
          }
        ],
        items,
        recipient_info: {
          first_name: recipient.firstName,
          last_name: recipient.lastName,
          phone: recipientPhone
        }
      };

      console.info('[READY_TO_SHIP] offers/create payload', {
        orderId,
        station_id: sourceStationId,
        station_id_type: isDigitsStationId(sourceStationId) ? 'digits' : typeof sourceStationId,
        self_pickup_id: selfPickupId,
        self_pickup_id_type: isUuid(selfPickupId) ? 'uuid' : typeof selfPickupId,
        itemsCount: items.length
      });

      let offersResponse: Record<string, unknown>;
      try {
        offersResponse = await yandexNddClient.offersCreate(offersBody);
      } catch (error) {
        if (error instanceof YandexNddHttpError && (error.status === 401 || error.status === 403)) {
          throw new NddValidationError('NDD_UNAUTHORIZED', 'Unauthorized request to Yandex NDD.', error.status, {
            status: error.status,
            path: error.path
          });
        }

        // если у тебя прокси/тест окружение и Яндекс кинул HTML SmartCaptcha, вылетит как AxiosError
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[READY_TO_SHIP] offers/create failed', { orderId, msg });

        // На твоей стороне уже есть YandexNddHttpError для SmartCaptcha, но тут сервис другой.
        // Поэтому просто нормализуем до понятного кода.
        if (msg.includes('403') || msg.toLowerCase().includes('captcha')) {
          throw new YandexNddHttpError('YANDEX_IP_BLOCKED', '/api/b2b/platform/offers/create', 403, msg, null);
        }

        if (msg === 'NO_DELIVERY_OPTIONS') throw new Error('NO_DELIVERY_OPTIONS');
        throw new Error('ORDER_DELIVERY_OFFER_FAILED');
      }

      const offersRaw = Array.isArray((offersResponse as any)?.offers) ? ((offersResponse as any).offers as Record<string, unknown>[]) : [];
      const bestOffer = pickBestOffer(offersRaw);
      const offerId =
        ((offersResponse as any)?.offer_id as string | undefined) ??
        ((bestOffer as any)?.offer_id as string | undefined) ??
        null;

      console.info('[READY_TO_SHIP] offers/create result', {
        orderId,
        offersCount: offersRaw.length,
        offerId
      });

      if (!offerId) {
        await shipmentService.upsertForOrder({
          orderId,
          deliveryMethod,
          sourceStationId,
          sourceStationSnapshot: asRecord(order.sellerDropoffPvzMeta),
          destinationStationId: buyerPickupPointId,
          destinationStationSnapshot: delivery?.pickupPoint ?? asRecord(order.buyerPickupPvzMeta),
          status: 'CREATED',
          statusRaw: { offersCreate: offersResponse }
        });
        throw new Error('ORDER_DELIVERY_OFFER_FAILED');
      }

      const confirm = await yandexNddClient.offersConfirm({ offer_id: offerId });
      let requestId =
        (confirm as any)?.request_id ??
        (confirm as any)?.request?.request_id ??
        null;

      let requestCreate: Record<string, unknown> | null = null;
      if (!requestId) {
        requestCreate = await yandexNddClient.requestCreate({ offer_id: offerId });
        requestId =
          (requestCreate as any)?.request_id ??
          (requestCreate as any)?.request?.request_id ??
          null;
      }

      if (!requestId) throw new Error('NDD_REQUEST_ID_MISSING');

      const yandexStatus = extractYandexStatus(confirm as any) ?? 'CREATED';
      const internalStatus = mapYandexStatusToInternal(yandexStatus);

      const statusRaw = {
        offersCreate: offersResponse,
        offersConfirm: confirm,
        requestCreate,
        lastStatus: yandexStatus,
        offerId
      };

      const updated = await shipmentService.upsertForOrder({
        orderId,
        deliveryMethod,
        sourceStationId,
        sourceStationSnapshot: asRecord(order.sellerDropoffPvzMeta),
        destinationStationId: buyerPickupPointId,
        destinationStationSnapshot: delivery?.pickupPoint ?? asRecord(order.buyerPickupPvzMeta),
        requestId,
        offerPayload: JSON.stringify(bestOffer ?? { offer_id: offerId }),
        status: internalStatus,
        statusRaw
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'READY_FOR_SHIPMENT',
          statusUpdatedAt: new Date(),
          readyForShipmentAt: new Date(),
          dropoffDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          yandexOfferId: offerId,
          yandexRequestId: requestId ?? undefined
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
      const info = await yandexNddClient.requestInfo(shipment.requestId);

      const yandexStatus =
        (history && extractYandexStatus(history as any)) ??
        (info && extractYandexStatus(info as any)) ??
        null;

      const internalStatus = mapYandexStatusToInternal(yandexStatus);
      const previousStatus = shipment.status;

      const statusRaw = {
        ...(shipment.statusRaw ?? {}),
        history,
        info,
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
    if (!shipment?.requestId) throw new Error('SHIPMENT_REQUEST_NOT_FOUND');

    const response = await yandexDeliveryService.generateLabels([shipment.requestId], 'one', 'ru');
    return {
      shipment,
      url: null,
      pdfBuffer: response?.buffer ?? null,
      raw: { contentType: response?.contentType ?? 'application/pdf' }
    };
  }
};

import { prisma } from '../lib/prisma';
import { orderDeliveryService } from './orderDeliveryService';
import { mapYandexStatusToInternal, shipmentService } from './shipmentService';
import { yandexNddClient } from './yandexNdd/YandexNddClient';

const pickBestOffer = (response: Record<string, unknown>) => {
  const offers = (response.offers as Record<string, unknown>[] | undefined) ?? [];
  if (!offers.length) return null;
  const sorted = [...offers].sort((a, b) => {
    const priceA = Number((a.price as Record<string, unknown> | undefined)?.amount ?? Number.MAX_SAFE_INTEGER);
    const priceB = Number((b.price as Record<string, unknown> | undefined)?.amount ?? Number.MAX_SAFE_INTEGER);
    return priceA - priceB;
  });
  return sorted[0];
};


const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const extractYandexStatus = (payload: Record<string, unknown>) => {
  const status =
    (payload.status as string | undefined) ??
    ((payload.request as Record<string, unknown> | undefined)?.status as string | undefined) ??
    (((payload.history as Record<string, unknown>[] | undefined) ?? [])[Math.max((((payload.history as Record<string, unknown>[] | undefined) ?? []).length - 1),0)]?.status as string | undefined);
  return status ?? null;
};

export const yandexNddShipmentOrchestrator = {
  readyToShip: async (sellerId: string, orderId: string) => {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: { some: { product: { sellerId } } }
      },
      include: {
        contact: true,
        buyer: true
      }
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.status !== 'PAID' || !order.paidAt) {
      throw new Error('ORDER_NOT_PAID');
    }

    if (!order.sellerDropoffPvzId || !order.buyerPickupPvzId) throw new Error('PICKUP_POINT_REQUIRED');

    const deliveryMap = await orderDeliveryService.getByOrderIds([orderId]);
    const delivery = deliveryMap.get(orderId);
    const deliveryMethod = 'PICKUP_POINT';

    const existing = await shipmentService.getByOrderId(orderId);
    if (existing?.requestId || existing?.offerPayload) {
      return existing;
    }

    const offersBody = {
      source_platform_station: order.sellerDropoffPvzId,
      destination_platform_station: order.buyerPickupPvzId,
      billing_info: {
        delivery_cost: 0,
        payment_method: 'already_paid'
      },
      places: [{ physical_dims: { weight_gross: 500, dx: 10, dy: 10, dz: 10 } }]
    };
    const offersResponse = await yandexNddClient.offersCreate(offersBody);
    const selectedOffer = pickBestOffer(offersResponse);

    if (!selectedOffer) {
      throw new Error('NDD_OFFERS_EMPTY');
    }

    const offersConfirmResponse = await yandexNddClient.offersConfirm({ offers: [selectedOffer] });
    const requestCreateResponse = await yandexNddClient.requestCreate({
      source_platform_station: order.sellerDropoffPvzId,
      destination_platform_station: order.buyerPickupPvzId,
      offer: selectedOffer,
      order_ref: orderId,
      recipient: {
        name: order.contact?.name ?? order.buyer.name,
        phone: order.contact?.phone ?? order.buyer.phone ?? ''
      }
    });

    const requestId =
      (requestCreateResponse.request_id as string | undefined) ??
      ((requestCreateResponse.request as Record<string, unknown> | undefined)?.request_id as string | undefined) ??
      '';
    if (!requestId) {
      throw new Error('NDD_REQUEST_ID_MISSING');
    }

    const yandexStatus = extractYandexStatus(requestCreateResponse) ?? 'CREATED';
    const internalStatus = mapYandexStatusToInternal(yandexStatus);
    const statusRaw = {
      yandex: requestCreateResponse,
      offersCreate: offersResponse,
      offersConfirm: offersConfirmResponse,
      lastStatus: yandexStatus
    };

    const updated = await shipmentService.upsertForOrder({
      orderId,
      deliveryMethod,
      sourceStationId: order.sellerDropoffPvzId,
      sourceStationSnapshot: asRecord(order.sellerDropoffPvzMeta),
      destinationStationId: order.buyerPickupPvzId!,
      destinationStationSnapshot: delivery?.pickupPoint ?? asRecord(order.buyerPickupPvzMeta),
      requestId,
      offerPayload: JSON.stringify(selectedOffer),
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
      const yandexStatus = extractYandexStatus(history) ?? extractYandexStatus(await yandexNddClient.requestInfo(shipment.requestId));
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

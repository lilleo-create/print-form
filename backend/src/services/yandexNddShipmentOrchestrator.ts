// src/services/yandexNddShipmentOrchestrator.ts
// NDD flow without merchant API: resolve PVZ -> offers/create -> offers/confirm -> request/info.

import { prisma } from '../lib/prisma';
import { yandexDeliveryService } from './yandexDeliveryService';
import { yandexNddClient } from './yandexNdd/YandexNddClient';
import { looksLikePvzId, NddValidationError } from './yandexNdd/nddIdSemantics';
import { resolvePvzIds } from './yandexNdd/resolvePvzIds';
import { buildOffersCreatePayload } from './yandexNdd/nddOffersPayload';
import type { OffersCreateResponse, OffersConfirmResponse, RequestInfoResponse } from './yandexNdd/nddTypes';

type CreateNddShipmentResult = {
  requestId: string;
  offerId?: string | null;
  raw?: unknown;
};

const asRecord = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};

const requirePvzId = (value: unknown, field: string): string => {
  if (!looksLikePvzId(value)) {
    throw new NddValidationError(`${field} must be PVZ id (uuid or 32hex).`, [
      { field, message: `${field} invalid`, value }
    ]);
  }
  return String(value).trim();
};

export const yandexNddShipmentOrchestrator = {
  /** Create NDD shipment: resolve PVZ -> offers/create -> offers/confirm -> request/info. No merchant_id. */
  async createForPaidOrder(orderId: string): Promise<CreateNddShipmentResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true, contact: true, items: { include: { product: true, variant: true } } }
    });

    if (!order) throw new Error('ORDER_NOT_FOUND');

    const sellerDropoffPvzId = requirePvzId(order.sellerDropoffPvzId, 'sellerDropoffPvzId');
    const buyerPickupPvzId = requirePvzId(order.buyerPickupPvzId, 'buyerPickupPvzId');

    const sellerId = (order.items?.[0] as any)?.product?.sellerId;
    if (!sellerId) {
      const err: any = new Error('NDD_SELLER_REQUIRED');
      err.code = 'NDD_SELLER_REQUIRED';
      err.message = 'Завершите «Подключение продавца» (точка отгрузки).';
      throw err;
    }

    const [sellerPvz, buyerPvz] = await Promise.all([
      resolvePvzIds(sellerDropoffPvzId),
      resolvePvzIds(buyerPickupPvzId)
    ]);

    console.info('[NDD][createForPaidOrder]', {
      orderId: order.id,
      sellerDropoffPvzId,
      buyerPickupPvzId,
      resolved: {
        sourcePlatformId: sellerPvz.platformId,
        sourceOperatorStationId: sellerPvz.operatorStationId,
        destPlatformId: buyerPvz.platformId,
        destOperatorStationId: buyerPvz.operatorStationId
      }
    });

    const payload = buildOffersCreatePayload({
      order: order as any,
      sellerPvz,
      buyerPvz
    });

    const offersResponse = await yandexNddClient.offersCreate(payload as Record<string, unknown>, {
      requestId: order.id,
      orderId: order.id
    }) as OffersCreateResponse;

    const offers = Array.isArray(offersResponse?.offers) ? offersResponse.offers : [];
    const firstOffer = offers[0];
    if (!firstOffer?.offer_id) {
      const err: any = new Error('NDD_NO_OFFERS');
      err.code = 'NDD_NO_OFFERS';
      err.message = 'Нет доступных вариантов доставки (no_delivery_options).';
      err.details = offersResponse;
      throw err;
    }

    const confirmResponse = await yandexNddClient.offersConfirm({
      offer_id: firstOffer.offer_id
    }) as OffersConfirmResponse;

    let requestId =
      String(confirmResponse?.request_id ?? (confirmResponse as any)?.request?.request_id ?? '').trim();
    if (!requestId) {
      const err: any = new Error('NDD_CONFIRM_NO_REQUEST_ID');
      err.code = 'NDD_CONFIRM_NO_REQUEST_ID';
      err.details = confirmResponse;
      throw err;
    }

    let status = String(confirmResponse?.status ?? (confirmResponse as any)?.request?.status ?? 'CREATED').trim();
    try {
      const info = await yandexNddClient.requestInfo(requestId) as RequestInfoResponse;
      status = String(info?.status ?? info?.request?.status ?? status).trim();
    } catch {
      // keep requestId and status from confirm
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        yandexRequestId: requestId,
        yandexStatus: status
      }
    });

    return { requestId, offerId: firstOffer.offer_id, raw: confirmResponse };
  },

  async readyToShip(sellerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, items: { some: { product: { sellerId } } } },
      include: { buyer: true, contact: true, items: { include: { product: true, variant: true } } }
    });

    if (!order) {
      const err: any = new Error('ORDER_NOT_FOUND');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    if (order.status !== 'PAID') {
      const err: any = new Error('ORDER_NOT_PAID');
      err.code = 'ORDER_NOT_PAID';
      throw err;
    }
    if (order.yandexRequestId && order.yandexRequestId !== 'PROCESSING') {
      return { ok: true, requestId: order.yandexRequestId, status: order.yandexStatus };
    }

    const result = await this.createForPaidOrder(order.id);
    return { ok: true, requestId: result.requestId };
  },

  async generateLabel(orderId: string): Promise<{ pdfBuffer?: Buffer; url?: string; raw?: unknown }> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      const err: any = new Error('ORDER_NOT_FOUND');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }
    if (!order.yandexRequestId || order.yandexRequestId === 'PROCESSING') {
      const err: any = new Error('NDD_REQUEST_ID_REQUIRED');
      err.code = 'NDD_REQUEST_ID_REQUIRED';
      throw err;
    }
    const { buffer, contentType } = await yandexDeliveryService.generateLabels(
      [order.yandexRequestId],
      'one',
      'ru'
    );
    if (!buffer || buffer.length === 0) {
      return { raw: { contentType, empty: true } };
    }
    return { pdfBuffer: buffer, raw: { contentType } };
  }
};

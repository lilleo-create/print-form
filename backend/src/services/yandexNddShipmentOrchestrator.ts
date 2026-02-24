// src/services/yandexNddShipmentOrchestrator.ts
// NDD flow: resolve PVZ -> request/create -> request/info.

import { prisma } from '../lib/prisma';
import { yandexDeliveryService } from './yandexDeliveryService';
import { yandexNddClient } from './yandexNdd/YandexNddClient';
import { looksLikePvzId, NddValidationError } from './yandexNdd/nddIdSemantics';
import { resolvePvzIds } from './yandexNdd/resolvePvzIds';
import { buildRequestCreatePayload } from './yandexNdd/nddOffersPayload';
import type { RequestInfoResponse } from './yandexNdd/nddTypes';
import { yandexMerchantService } from './yandexMerchantService';

type CreateNddShipmentResult = {
  requestId: string;
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
  /** Create NDD shipment: resolve PVZ -> request/create -> request/info. */
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

    const merchantEnsureResult = await yandexMerchantService.ensureForSeller(String(sellerId));
    let merchantId = merchantEnsureResult.status === 'ready' ? merchantEnsureResult.merchantId.trim() : '';

    if (!merchantId) {
      // Fallback for legacy single-merchant setup.
      merchantId = String(process.env.YANDEX_NDD_MERCHANT_ID ?? process.env.YANDEX_MERCHANT_ID ?? '').trim();
    }

    if (!merchantId) {
      const err: any = new Error('NDD_MERCHANT_ID_REQUIRED');
      err.code = 'NDD_MERCHANT_NOT_READY';
      err.message = 'Не задан merchant_id для request/create. Завершите регистрацию мерчанта в Яндекс Доставке.';
      err.details = merchantEnsureResult;
      throw err;
    }

    const payload = buildRequestCreatePayload({
      order: order as any,
      sellerPvz,
      buyerPvz,
      merchantId
    });

    console.info('[NDD][request/create]', {
      orderId: order.id,
      sourcePlatformId: sellerPvz.platformId,
      destPlatformId: buyerPvz.platformId
    });

    let createResponse: any;
    try {
      createResponse = await yandexNddClient.requestCreate(payload as Record<string, unknown>, {
        requestId: order.id,
        orderId: order.id
      });
    } catch (err: any) {
      const status = Number(err?.status ?? 0);
      const details = err?.details ?? null;
      if (status === 400 && (details?.code === 'no_delivery_options' || /no_delivery_options/i.test(JSON.stringify(details)))) {
        err.code = 'NDD_NO_DELIVERY_OPTIONS';
      }
      if (status === 403 && !err?.code) err.code = 'NDD_NO_PERMISSIONS';
      if (status >= 500 && !err?.code) err.code = 'NDD_REQUEST_FAILED';
      throw err;
    }

    console.info('[NDD][request/create][response]', {
      orderId: order.id,
      requestId: (createResponse as any)?.request_id ?? (createResponse as any)?.request?.request_id ?? null,
      status: (createResponse as any)?.status ?? (createResponse as any)?.request?.status ?? null
    });

    let requestId =
      String(createResponse?.request_id ?? (createResponse as any)?.request?.request_id ?? '').trim();
    if (!requestId) {
      const err: any = new Error('NDD_REQUEST_CREATE_NO_REQUEST_ID');
      err.code = 'NDD_REQUEST_CREATE_NO_REQUEST_ID';
      err.details = createResponse;
      throw err;
    }

    let status = String(createResponse?.status ?? (createResponse as any)?.request?.status ?? 'CREATED').trim();
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

    return { requestId, raw: createResponse };
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

import { yandexDeliveryIntegration } from '../../integrations/yandexDelivery';
import { mapYandexError, type AppError } from '../../integrations/yandexDelivery/errors';

const asString = (value: unknown): string | undefined => {
  const s = String(value ?? '').trim();
  return s || undefined;
};

const asNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export class YandexDeliveryService {
  async listPickupPoints(destination: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    try {
      const response = await yandexDeliveryIntegration.pickupPointsList(destination, meta);
      const points = response.points ?? response.result?.points ?? [];
      return points.map((point) => ({
        pickupPointId: asString((point as any).id) ?? asString((point as any).point_id) ?? asString((point as any).pickup_point_id) ?? '',
        name: asString((point as any).name),
        address: asString((point as any).address?.full_address ?? (point as any).address),
        platformStationId: asString((point as any).platform_station_id),
        operatorStationId: asString((point as any).operator_station_id),
        latitude: asNumber((point as any).latitude ?? (point as any).location?.latitude),
        longitude: asNumber((point as any).longitude ?? (point as any).location?.longitude),
      })).filter((point) => Boolean(point.pickupPointId));
    } catch (error) {
      throw mapYandexError(error);
    }
  }

  async detectGeoId(query: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    try {
      return await yandexDeliveryIntegration.locationDetect({ full_address: query }, meta);
    } catch (error) {
      throw mapYandexError(error);
    }
  }

  async createOffers(orderDraft: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    return yandexDeliveryIntegration.offersCreate(orderDraft, meta);
  }

  async confirmOffer(offerId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    return yandexDeliveryIntegration.offersConfirm(offerId, meta);
  }

  async createRequestFromConfirmedOffer(payload: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    return yandexDeliveryIntegration.requestCreate(payload, meta);
  }

  async getRequestInfo(requestId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    return yandexDeliveryIntegration.requestInfo(requestId, meta);
  }

  async cancelRequest(requestId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    return yandexDeliveryIntegration.requestCancel(requestId, meta);
  }

  async generateLabels(requestIds: string[], _generateType: 'one' | 'many' = 'one', _language = 'ru', meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    const buffer = await yandexDeliveryIntegration.requestGenerateLabels(requestIds, meta);
    return { buffer: Buffer.from(buffer), contentType: 'application/pdf' };
  }

  async getHandoverAct(params: Record<string, unknown>, body: Record<string, unknown> = {}, meta?: { requestId?: string; sellerId?: string; orderId?: string }) {
    const buffer = await yandexDeliveryIntegration.requestHandoverAct(params, body, meta);
    return { buffer: Buffer.from(buffer), contentType: 'application/pdf' };
  }

  // available, not yet orchestrated in routes
  mapError(error: unknown): AppError {
    return mapYandexError(error);
  }
}

export const yandexDeliveryOrchestrator = new YandexDeliveryService();

import { yandexDeliveryOrchestrator } from './delivery/YandexDeliveryService';

export const yandexDeliveryService = {
  listPickupPoints: (payload: Record<string, unknown>) => yandexDeliveryOrchestrator.listPickupPoints(payload),
  detectGeoId: (query: string) => yandexDeliveryOrchestrator.detectGeoId(query),
  createOffers: (payload: Record<string, unknown>) => yandexDeliveryOrchestrator.createOffers(payload),
  confirmOffer: (offerId: string) => yandexDeliveryOrchestrator.confirmOffer(offerId),
  createRequest: (payload: Record<string, unknown>) => yandexDeliveryOrchestrator.createRequestFromConfirmedOffer(payload),
  getRequestInfo: (requestId: string) => yandexDeliveryOrchestrator.getRequestInfo(requestId),
  cancelRequest: (requestId: string) => yandexDeliveryOrchestrator.cancelRequest(requestId),
  generateLabels: (requestIds: string[], generateType: 'one' | 'many' = 'one', language = 'ru') =>
    yandexDeliveryOrchestrator.generateLabels(requestIds, generateType, language),
  getHandoverAct: (params: Record<string, unknown>, body?: Record<string, unknown>) =>
    yandexDeliveryOrchestrator.getHandoverAct(params, body),
  getRequestHistory: async (_requestId: string) => null,
  getActualInfo: async (_requestId: string) => null,
  merchantRegistrationInit: async () => {
    throw new Error('NOT_IMPLEMENTED');
  },
  merchantRegistrationStatus: async () => {
    throw new Error('NOT_IMPLEMENTED');
  },
  merchantInfo: async () => {
    throw new Error('NOT_IMPLEMENTED');
  },
};

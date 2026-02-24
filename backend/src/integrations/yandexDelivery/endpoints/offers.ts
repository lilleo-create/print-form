import { YandexDeliveryClient, type RequestMeta } from '../YandexDeliveryClient';
import { offersConfirmRequestSchema, offersCreateRequestSchema } from '../types/offers';

export const offersCreate = async (client: YandexDeliveryClient, body: Record<string, unknown>, meta?: RequestMeta) => {
  const payload = offersCreateRequestSchema.parse(body);
  return client.post<Record<string, unknown>>('/api/b2b/platform/offers/create', payload, undefined, meta);
};

export const offersConfirm = async (client: YandexDeliveryClient, offerId: string, meta?: RequestMeta) => {
  const payload = offersConfirmRequestSchema.parse({ offer_id: offerId });
  return client.post<Record<string, unknown>>('/api/b2b/platform/offers/confirm', payload, undefined, meta);
};

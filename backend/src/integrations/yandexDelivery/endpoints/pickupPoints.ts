import { YandexDeliveryClient, type RequestMeta } from '../YandexDeliveryClient';
import { pickupPointsListRequestSchema, pickupPointsListResponseSchema, type PickupPointsListRequest } from '../types/pickupPoints';

export const pickupPointsList = async (client: YandexDeliveryClient, body: PickupPointsListRequest, meta?: RequestMeta) => {
  const payload = pickupPointsListRequestSchema.parse(body);
  const response = await client.post<unknown>('/api/b2b/platform/pickup-points/list', payload, undefined, meta);
  return pickupPointsListResponseSchema.parse(response);
};

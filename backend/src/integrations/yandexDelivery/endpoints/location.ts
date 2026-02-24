import { YandexDeliveryClient, type RequestMeta } from '../YandexDeliveryClient';
import { locationDetectRequestSchema, locationDetectResponseSchema, type LocationDetectRequest } from '../types/location';

export const locationDetect = async (client: YandexDeliveryClient, body: LocationDetectRequest, meta?: RequestMeta) => {
  const payload = locationDetectRequestSchema.parse(body);
  const response = await client.post<unknown>('/api/b2b/platform/location/detect', payload, undefined, meta);
  return locationDetectResponseSchema.parse(response);
};

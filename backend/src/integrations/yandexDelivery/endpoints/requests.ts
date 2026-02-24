import { YandexDeliveryClient, type RequestMeta } from '../YandexDeliveryClient';
import { generateLabelsRequestSchema, requestCancelRequestSchema, requestCreateRequestSchema } from '../types/requests';

export const requestCreate = async (client: YandexDeliveryClient, body: Record<string, unknown>, meta?: RequestMeta) => {
  const payload = requestCreateRequestSchema.parse(body);
  return client.post<Record<string, unknown>>('/api/b2b/platform/request/create', payload, undefined, meta);
};

export const requestInfo = async (client: YandexDeliveryClient, requestId: string, meta?: RequestMeta) => {
  return client.get<Record<string, unknown>>('/api/b2b/platform/request/info', { request_id: requestId }, meta);
};

export const requestCancel = async (client: YandexDeliveryClient, requestId: string, meta?: RequestMeta) => {
  const payload = requestCancelRequestSchema.parse({ request_id: requestId });
  return client.post<Record<string, unknown>>('/api/b2b/platform/request/cancel', payload, undefined, meta);
};

export const requestGenerateLabels = async (client: YandexDeliveryClient, requestIds: string[], meta?: RequestMeta) => {
  const payload = generateLabelsRequestSchema.parse({ request_ids: requestIds });
  return client.post<ArrayBuffer>('/api/b2b/platform/request/generate-labels', payload, undefined, meta, 'arraybuffer');
};

export const requestHandoverAct = async (client: YandexDeliveryClient, params: Record<string, unknown>, body: Record<string, unknown>, meta?: RequestMeta) => {
  return client.post<ArrayBuffer>('/api/b2b/platform/request/get-handover-act', body, params, meta, 'arraybuffer');
};

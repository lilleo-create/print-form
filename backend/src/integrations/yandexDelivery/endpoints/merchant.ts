import type { RequestMeta, YandexDeliveryClient } from '../YandexDeliveryClient';

export function merchantRegistrationInit(
  client: YandexDeliveryClient,
  externalMerchantId: string,
  body: Record<string, unknown>,
  meta?: RequestMeta
): Promise<{ registration_id: string }> {
  return client.post<{ registration_id: string }>(
    '/api/b2b/platform/merchant/registration/init',
    body,
    { external_merchant_id: externalMerchantId },
    meta
  );
}

export function merchantRegistrationStatus(
  client: YandexDeliveryClient,
  registrationId: string,
  meta?: RequestMeta
): Promise<{ status: 'in_progress' | 'success' | 'validation_error'; merchant_id?: string; error?: unknown }> {
  return client.get<{ status: 'in_progress' | 'success' | 'validation_error'; merchant_id?: string; error?: unknown }>(
    '/api/b2b/platform/merchant/registration/status',
    { registration_id: registrationId },
    meta
  );
}

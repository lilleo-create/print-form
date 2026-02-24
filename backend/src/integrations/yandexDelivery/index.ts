import { YandexDeliveryClient } from './YandexDeliveryClient';
import { locationDetect } from './endpoints/location';
import { merchantRegistrationInit, merchantRegistrationStatus } from './endpoints/merchant';
import { offersConfirm, offersCreate } from './endpoints/offers';
import { pickupPointsList } from './endpoints/pickupPoints';
import { requestCancel, requestCreate, requestGenerateLabels, requestHandoverAct, requestInfo } from './endpoints/requests';

const client = new YandexDeliveryClient();

export const yandexDeliveryIntegration = {
  pickupPointsList: (body: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => pickupPointsList(client, body, meta),
  locationDetect: (body: { full_address: string }, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => locationDetect(client, body, meta),
  offersCreate: (body: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => offersCreate(client, body, meta),
  offersConfirm: (offerId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => offersConfirm(client, offerId, meta),
  requestCreate: (body: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => requestCreate(client, body, meta),
  requestInfo: (requestId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => requestInfo(client, requestId, meta),
  requestCancel: (requestId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => requestCancel(client, requestId, meta),
  requestGenerateLabels: (requestIds: string[], meta?: { requestId?: string; sellerId?: string; orderId?: string }) => requestGenerateLabels(client, requestIds, meta),
  requestHandoverAct: (params: Record<string, unknown>, body: Record<string, unknown>, meta?: { requestId?: string; sellerId?: string; orderId?: string }) => requestHandoverAct(client, params, body, meta),
  merchantRegistrationInit: (
    externalMerchantId: string,
    body: Record<string, unknown>,
    meta?: { requestId?: string; sellerId?: string; orderId?: string }
  ) => merchantRegistrationInit(client, externalMerchantId, body, meta),
  merchantRegistrationStatus: (registrationId: string, meta?: { requestId?: string; sellerId?: string; orderId?: string }) =>
    merchantRegistrationStatus(client, registrationId, meta),
};

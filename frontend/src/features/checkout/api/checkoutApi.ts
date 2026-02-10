import { createFetchClient } from '../../../shared/api/client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const client = createFetchClient(baseUrl);

export type DeliveryMethodCode = 'ADDRESS' | 'PICKUP';
export type PaymentMethodCode = 'CARD' | 'SBP';
export type PickupProvider = 'CDEK' | 'YANDEX';

export type CheckoutDto = {
  recipient: { name: string; phone: string; email: string };
  address: {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
    apartment?: string | null;
    floor?: string | null;
    comment?: string | null;
  } | null;
  selectedPickupPoint?: PickupPointDto | null;
  selectedDeliveryMethod?: DeliveryMethodCode;
  selectedDeliverySubType?: string | null;
  selectedPaymentMethod?: PaymentMethodCode;
  selectedCardId?: string | null;
  deliveryMethods: Array<{ id: string; code: DeliveryMethodCode; title: string; description?: string }>;
  paymentMethods: Array<{ id: string; code: PaymentMethodCode; title: string }>;
  savedCards: Array<{ id: string; brand: string; last4: string; expMonth: number; expYear: number }>;
  cartItems: Array<{
    productId: string;
    title: string;
    price: number;
    quantity: number;
    image?: string | null;
    shortSpec?: string | null;
    deliveryDate?: string | null;
    deliveryEtaDays?: number | null;
  }>;
};

export type PickupPointDto = {
  id: string;
  provider: PickupProvider;
  address: string;
  lat: number;
  lng: number;
  title?: string;
  workHours?: string;
};

export const checkoutApi = {
  fetchCheckout: async (signal?: AbortSignal) => {
    const response = await client.request<CheckoutDto>('/checkout', { signal });
    return response.data;
  },
  setDeliveryMethod: async (payload: { methodCode: DeliveryMethodCode; subType?: string }, signal?: AbortSignal) => {
    await client.request('/checkout/delivery-method', { method: 'PUT', body: payload, signal });
  },
  setPickupPoint: async (payload: { pickupPointId: string; provider: PickupProvider }, signal?: AbortSignal) => {
    await client.request('/checkout/pickup', { method: 'PUT', body: payload, signal });
  },
  updateRecipient: async (payload: { name: string; phone: string; email: string }, signal?: AbortSignal) => {
    await client.request('/checkout/recipient', { method: 'PUT', body: payload, signal });
  },
  updateAddress: async (
    payload: { line1: string; city: string; postalCode: string; country: string; apartment?: string; floor?: string; comment?: string },
    signal?: AbortSignal
  ) => {
    await client.request('/checkout/address', { method: 'PUT', body: payload, signal });
  },
  fetchPickupPoints: async (params: { provider?: PickupProvider; lat?: number; lng?: number; radiusKm?: number }, signal?: AbortSignal) => {
    const search = new URLSearchParams();
    if (params.provider) search.set('provider', params.provider);
    if (typeof params.lat === 'number') search.set('lat', String(params.lat));
    if (typeof params.lng === 'number') search.set('lng', String(params.lng));
    if (params.radiusKm) search.set('radiusKm', String(params.radiusKm));
    const response = await client.request<{ items: PickupPointDto[] }>(`/api/pickup-points?${search.toString()}`, { signal });
    return response.data.items ?? [];
  },
  setPaymentMethod: async (payload: { methodCode: PaymentMethodCode; cardId?: string }, signal?: AbortSignal) => {
    await client.request('/checkout/payment-method', { method: 'PUT', body: payload, signal });
  },
  addCard: async (payload: { cardNumber: string; expMonth: string; expYear: string; cvv: string }, signal?: AbortSignal) => {
    const response = await client.request<{ id: string; brand: string; last4: string; expMonth: number; expYear: number }>('/checkout/cards', {
      method: 'POST',
      body: payload,
      signal
    });
    return response.data;
  },
  placeOrder: async (payload: {
    delivery: { method: DeliveryMethodCode; address?: CheckoutDto['address']; pickupPointId?: string; provider?: PickupProvider };
    recipient: CheckoutDto['recipient'];
    payment: { method: PaymentMethodCode; cardId?: string };
    items: Array<{ productId: string; quantity: number }>;
  }, signal?: AbortSignal) => {
    const response = await client.request<{ orderId: string }>('/orders', { method: 'POST', body: payload, signal });
    return response.data;
  }
};

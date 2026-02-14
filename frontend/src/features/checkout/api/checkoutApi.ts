import { createFetchClient } from '../../../shared/api/client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const client = createFetchClient(baseUrl);

export type DeliveryMethodCode = 'COURIER' | 'PICKUP_POINT';
export type PaymentMethodCode = 'CARD' | 'SBP';
export type YaPvzSelection = {
  provider: 'YANDEX_NDD';
  pvzId: string;
  addressFull?: string;
  raw?: unknown;
};

export type PickupPoint = YaPvzSelection;

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
  selectedPickupPoint?: YaPvzSelection | null;
  selectedDeliveryMethod?: DeliveryMethodCode;
  selectedDeliverySubType?: string | null;
  selectedPaymentMethod?: PaymentMethodCode;
  selectedCardId?: string | null;
  sellerDropoffStationId?: string;
  deliveryMethods: Array<{
    id: string;
    code: DeliveryMethodCode;
    title: string;
    description?: string;
  }>;
  paymentMethods: Array<{ id: string; code: PaymentMethodCode; title: string }>;
  savedCards: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  }>;
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

const normalizePickupPoint = (pickupPoint: unknown): YaPvzSelection | null => {
  if (!pickupPoint || typeof pickupPoint !== 'object') return null;

  const raw = pickupPoint as Record<string, unknown>;
  const pvzId =
    typeof raw.pvzId === 'string'
      ? raw.pvzId
      : typeof raw.id === 'string'
        ? raw.id
        : '';
  if (!pvzId) return null;

  const addressFull =
    typeof raw.addressFull === 'string'
      ? raw.addressFull
      : typeof raw.fullAddress === 'string'
        ? raw.fullAddress
        : undefined;

  return {
    provider: 'YANDEX_NDD',
    pvzId,
    addressFull,
    raw: raw.raw ?? pickupPoint
  };
};

export const checkoutApi = {
  fetchCheckout: async (signal?: AbortSignal) => {
    const response = await client.request<CheckoutDto>('/checkout', { signal });
    return {
      ...response.data,
      selectedPickupPoint: normalizePickupPoint(
        response.data.selectedPickupPoint
      )
    };
  },
  setDeliveryMethod: async (
    payload: { methodCode: DeliveryMethodCode; subType?: string },
    signal?: AbortSignal
  ) => {
    await client.request('/checkout/delivery-method', {
      method: 'PUT',
      body: payload,
      signal
    });
  },
  setPickupPoint: async (
    payload: { pickupPoint: YaPvzSelection },
    signal?: AbortSignal
  ) => {
    await client.request('/checkout/pickup', {
      method: 'PUT',
      body: {
        provider: payload.pickupPoint.provider,
        pickupPoint: {
          id: payload.pickupPoint.pvzId,
          fullAddress:
            payload.pickupPoint.addressFull ?? payload.pickupPoint.pvzId,
          ...(payload.pickupPoint.raw &&
          typeof payload.pickupPoint.raw === 'object'
            ? (payload.pickupPoint.raw as Record<string, unknown>)
            : {})
        }
      },
      signal
    });
  },
  updateRecipient: async (
    payload: { name: string; phone: string; email: string },
    signal?: AbortSignal
  ) => {
    await client.request('/checkout/recipient', {
      method: 'PUT',
      body: payload,
      signal
    });
  },
  updateAddress: async (
    payload: {
      line1: string;
      city: string;
      postalCode: string;
      country: string;
      apartment?: string;
      floor?: string;
      comment?: string;
    },
    signal?: AbortSignal
  ) => {
    await client.request('/checkout/address', {
      method: 'PUT',
      body: payload,
      signal
    });
  },
  setPaymentMethod: async (
    payload: { methodCode: PaymentMethodCode; cardId?: string },
    signal?: AbortSignal
  ) => {
    await client.request('/checkout/payment-method', {
      method: 'PUT',
      body: payload,
      signal
    });
  },
  addCard: async (
    payload: {
      cardNumber: string;
      expMonth: string;
      expYear: string;
      cvv: string;
    },
    signal?: AbortSignal
  ) => {
    const response = await client.request<{
      id: string;
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    }>('/checkout/cards', {
      method: 'POST',
      body: payload,
      signal
    });
    return response.data;
  },
  startPayment: async (
    payload: {
      paymentAttemptKey: string;
      recipient: { name: string; phone: string; email?: string | null };
      packagesCount?: number;
      buyerPickupPvz: YaPvzSelection;
      items: Array<{ productId: string; quantity: number }>;
    },
    signal?: AbortSignal
  ) => {
    const response = await client.request<{
      orderId: string;
      paymentId: string;
      paymentUrl: string;
    }>('/payments/start', {
      method: 'POST',
      body: payload,
      signal
    });
    return response.data;
  },
  mockSuccess: async (paymentId: string, signal?: AbortSignal) => {
    await client.request(`/payments/${paymentId}/mock-success`, {
      method: 'POST',
      signal
    });
  }
};

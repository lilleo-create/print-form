import { create } from 'zustand';
import {
  checkoutApi,
  type CheckoutDto,
  type DeliveryMethodCode,
  type PaymentMethodCode,
  type YaPvzSelection
} from '../api/checkoutApi';

type CheckoutState = {
  data: CheckoutDto | null;
  isLoading: boolean;
  error: string | null;
  isSubmittingOrder: boolean;
  fetchCheckout: () => Promise<void>;
  setDeliveryMethod: (
    methodCode: DeliveryMethodCode,
    subType?: string
  ) => Promise<void>;
  setPickupPoint: (pickupPoint: YaPvzSelection) => Promise<void>;
  updateRecipient: (payload: CheckoutDto['recipient']) => Promise<void>;
  updateAddress: (
    payload: NonNullable<CheckoutDto['address']>
  ) => Promise<void>;
  setPaymentMethod: (
    methodCode: PaymentMethodCode,
    cardId?: string
  ) => Promise<void>;
  addCard: (payload: {
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvv: string;
  }) => Promise<void>;
  placeOrder: () => Promise<{ orderId: string; paymentId: string; paymentUrl: string } | null>;
};

let fetchController: AbortController | null = null;

const withRefetch = async (
  fn: () => Promise<void>,
  fetchCheckout: () => Promise<void>
) => {
  await fn();
  await fetchCheckout();
};

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  isSubmittingOrder: false,

  fetchCheckout: async () => {
    fetchController?.abort();
    const controller = new AbortController();
    fetchController = controller;
    set({ isLoading: true, error: null });
    try {
      const data = await checkoutApi.fetchCheckout(controller.signal);
      if (controller.signal.aborted) return;
      set({ data, isLoading: false, error: null });
    } catch (error) {
      if (controller.signal.aborted) return;
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить checkout.'
      });
    }
  },

  setDeliveryMethod: async (methodCode, subType) => {
    try {
      await withRefetch(
        () => checkoutApi.setDeliveryMethod({ methodCode, subType }),
        get().fetchCheckout
      );
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось обновить способ доставки.'
      });
    }
  },

  setPickupPoint: async (pickupPoint) => {
    try {
      await withRefetch(
        () => checkoutApi.setPickupPoint({ pickupPoint }),
        get().fetchCheckout
      );
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Не удалось выбрать ПВЗ.'
      });
    }
  },

  updateRecipient: async (payload) => {
    try {
      await withRefetch(
        () => checkoutApi.updateRecipient(payload),
        get().fetchCheckout
      );
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось обновить получателя.'
      });
    }
  },

  updateAddress: async (payload) => {
    try {
      await withRefetch(
        () =>
          checkoutApi.updateAddress({
            ...payload,
            apartment: payload.apartment ?? undefined,
            floor: payload.floor ?? undefined,
            comment: payload.comment ?? undefined
          }),
        get().fetchCheckout
      );
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Не удалось обновить адрес.'
      });
    }
  },

  setPaymentMethod: async (methodCode, cardId) => {
    try {
      await withRefetch(
        () => checkoutApi.setPaymentMethod({ methodCode, cardId }),
        get().fetchCheckout
      );
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось обновить способ оплаты.'
      });
    }
  },

  addCard: async (payload) => {
    try {
      const card = await checkoutApi.addCard(payload);
      await checkoutApi.setPaymentMethod({
        methodCode: 'CARD',
        cardId: card.id
      });
      await get().fetchCheckout();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Не удалось добавить карту.'
      });
    }
  },

  placeOrder: async () => {
    if (get().isSubmittingOrder) {
      return null;
    }
    const data = get().data;
    if (!data) return null;

    set({ isSubmittingOrder: true, error: null });

    try {
      const pvzId = data.selectedPickupPoint?.pvzId?.trim() ?? '';
      if (!pvzId) {
        set({
          isSubmittingOrder: false,
          error: 'Выберите ПВЗ перед оформлением заказа.'
        });
        return null;
      }

      const selectedPointRaw =
        data.selectedPickupPoint?.raw && typeof data.selectedPickupPoint.raw === 'object'
          ? (data.selectedPickupPoint.raw as Record<string, unknown>)
          : {};
      const buyerPickupStationId =
        data.selectedPickupPoint?.buyerPickupStationId ??
        (typeof selectedPointRaw.buyerPickupStationId === 'string' ? selectedPointRaw.buyerPickupStationId : undefined) ??
        (typeof selectedPointRaw.operator_station_id === 'string' ? selectedPointRaw.operator_station_id : undefined);

      const buyerPickupPvz = {
        provider: 'YANDEX_NDD' as const,
        pvzId,
        buyerPickupStationId,
        addressFull: data.selectedPickupPoint?.addressFull,
        raw: {
          ...selectedPointRaw,
          id: pvzId,
          buyerPickupPointId: pvzId,
          buyerPickupStationId,
          addressFull: data.selectedPickupPoint?.addressFull
        }
      };

      if (import.meta.env.DEV) {
        console.debug('[Checkout] placeOrder payload', { buyerPickupPvz });
      }

      const paymentAttemptKey = crypto.randomUUID();
      const response = await checkoutApi.startPayment({
        paymentAttemptKey,
        recipient: {
          name: data.recipient.name,
          phone: data.recipient.phone,
          email: data.recipient.email || null
        },
        packagesCount: 1,
        buyerPickupPvz,
        items: data.cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });

      set({
        isSubmittingOrder: false,
        error:
          response.deliveryConfigMissing && response.blockingReason === 'SELLER_DROPOFF_PVZ_REQUIRED'
            ? 'Нужно настроить точку отгрузки продавца. Оплата доступна, но отгрузка будет заблокирована до настройки.'
            : null
      });
      return { orderId: response.orderId, paymentId: response.paymentId, paymentUrl: response.paymentUrl };
    } catch (error) {
      set({
        isSubmittingOrder: false,
        error:
          error instanceof Error ? error.message : 'Не удалось оформить заказ.'
      });
      return null;
    }
  }
}));

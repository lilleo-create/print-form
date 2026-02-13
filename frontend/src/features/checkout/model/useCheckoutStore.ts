import { create } from 'zustand';
import { checkoutApi, type CheckoutDto, type DeliveryMethodCode, type PaymentMethodCode, type YaPvzSelection } from '../api/checkoutApi';

type CheckoutState = {
  data: CheckoutDto | null;
  isLoading: boolean;
  error: string | null;
  isSubmittingOrder: boolean;
  fetchCheckout: () => Promise<void>;
  setDeliveryMethod: (methodCode: DeliveryMethodCode, subType?: string) => Promise<void>;
  setPickupPoint: (pickupPoint: YaPvzSelection) => Promise<void>;
  updateRecipient: (payload: CheckoutDto['recipient']) => Promise<void>;
  updateAddress: (payload: NonNullable<CheckoutDto['address']>) => Promise<void>;
  setPaymentMethod: (methodCode: PaymentMethodCode, cardId?: string) => Promise<void>;
  addCard: (payload: { cardNumber: string; expMonth: string; expYear: string; cvv: string }) => Promise<void>;
  placeOrder: () => Promise<string | null>;
};

let fetchController: AbortController | null = null;

const withRefetch = async (fn: () => Promise<void>, fetchCheckout: () => Promise<void>) => {
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
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Не удалось загрузить checkout.' });
    }
  },

  setDeliveryMethod: async (methodCode, subType) => {
    try {
      await withRefetch(() => checkoutApi.setDeliveryMethod({ methodCode, subType }), get().fetchCheckout);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось обновить способ доставки.' });
    }
  },

  setPickupPoint: async (pickupPoint) => {
    try {
      await withRefetch(() => checkoutApi.setPickupPoint({ pickupPoint }), get().fetchCheckout);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось выбрать ПВЗ.' });
    }
  },

  updateRecipient: async (payload) => {
    try {
      await withRefetch(() => checkoutApi.updateRecipient(payload), get().fetchCheckout);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось обновить получателя.' });
    }
  },

  updateAddress: async (payload) => {
    try {
      await withRefetch(() => checkoutApi.updateAddress({
        ...payload,
        apartment: payload.apartment ?? undefined,
        floor: payload.floor ?? undefined,
        comment: payload.comment ?? undefined
      }), get().fetchCheckout);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось обновить адрес.' });
    }
  },

  setPaymentMethod: async (methodCode, cardId) => {
    try {
      await withRefetch(() => checkoutApi.setPaymentMethod({ methodCode, cardId }), get().fetchCheckout);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось обновить способ оплаты.' });
    }
  },

  addCard: async (payload) => {
    try {
      const card = await checkoutApi.addCard(payload);
      await checkoutApi.setPaymentMethod({ methodCode: 'CARD', cardId: card.id });
      await get().fetchCheckout();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось добавить карту.' });
    }
  },

  placeOrder: async () => {
    const data = get().data;
    if (!data) return null;

    set({ isSubmittingOrder: true, error: null });

    try {
      const response = await checkoutApi.placeOrder({
        delivery: {
          deliveryMethod: 'PICKUP_POINT',
          buyerPickupPvz: data.selectedPickupPoint ?? undefined
        },
        recipient: data.recipient,
        payment: {
          method: data.selectedPaymentMethod ?? 'CARD',
          cardId: data.selectedCardId ?? undefined
        },
        items: data.cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      });

      set({ isSubmittingOrder: false });
      return response.orderId;
    } catch (error) {
      set({
        isSubmittingOrder: false,
        error: error instanceof Error ? error.message : 'Не удалось оформить заказ.'
      });
      return null;
    }
  }
}));

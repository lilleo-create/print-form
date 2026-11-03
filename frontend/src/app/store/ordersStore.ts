import { create } from 'zustand';
import { ordersApi } from '../../shared/api/ordersApi';
import { Order, OrderItem, User } from '../../shared/types';

const checkoutAttemptStorageKey = 'printform:checkout-order-attempt';
let pendingCheckout: { signature: string; promise: Promise<Order> } | null = null;

const checkoutAttemptKey = (signature: string): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(checkoutAttemptStorageKey) || 'null') as { signature?: string; key?: string } | null;
      if (stored?.signature === signature && stored.key) return stored.key;
    } catch { /* use a new key */ }
  }
  const key = crypto.randomUUID();
  if (typeof window !== 'undefined') window.sessionStorage.setItem(checkoutAttemptStorageKey, JSON.stringify({ signature, key }));
  return key;
};

interface OrdersState {
  orders: Order[];
  loadBuyerOrders: (user: User) => Promise<void>;
  loadSellerOrders: (sellerId: string) => Promise<void>;
  updateOrder: (order: Order) => void;
  createOrder: (payload: {
    user: User;
    contactId: string;
    shippingAddressId: string;
    items: OrderItem[];
    total: number;
    deliveryMethod?: 'courier' | 'cdek_pvz';
    cdekPvzCode?: string;
    cdekPvzAddress?: string;
    cdekPvzCityCode?: number;
    cdekPvzRaw?: {
      city_code: number;
      city?: string;
      address_full?: string;
      latitude?: number;
      longitude?: number;
      work_time?: string;
    };
  }) => Promise<Order>;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  async loadBuyerOrders(user) {
    const data = await ordersApi.listByBuyer(user.id);
    set({ orders: data });
  },
  async loadSellerOrders(sellerId) {
    const data = await ordersApi.listBySeller(sellerId);
    set({ orders: data });
  },
  updateOrder(order) {
    set((state) => ({
      orders: state.orders.map((existing) =>
        existing.id === order.id ? order : existing
      )
    }));
  },
  async createOrder({
    user,
    contactId,
    shippingAddressId,
    items,
    total,
    deliveryMethod,
    cdekPvzCode,
    cdekPvzAddress,
    cdekPvzCityCode,
    cdekPvzRaw
  }) {
    const signature = JSON.stringify({ buyerId: user.id, contactId, shippingAddressId, deliveryMethod, cdekPvzCode,
      items: items.map(item => [item.productId, item.qty]) });
    if (pendingCheckout?.signature === signature) return pendingCheckout.promise;
    const paymentAttemptKey = checkoutAttemptKey(signature);
    const promise = ordersApi.create({
      paymentAttemptKey,
      buyerId: user.id,
      buyerEmail: user.email,
      contactId,
      shippingAddressId,
      items,
      total,
      deliveryMethod,
      cdekPvzCode,
      cdekPvzAddress,
      cdekPvzCityCode,
      cdekPvzRaw
    }).then(order => {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(checkoutAttemptStorageKey);
      set((state) => ({ orders: [order, ...state.orders] }));
      return order;
    }).finally(() => { pendingCheckout = null; });
    pendingCheckout = { signature, promise };
    return promise;
  }
}));

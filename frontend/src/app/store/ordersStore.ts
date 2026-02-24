import { create } from 'zustand';
import { ordersApi } from '../../shared/api/ordersApi';
import { Order, OrderItem, User } from '../../shared/types';

interface OrdersState {
  orders: Order[];
  loadBuyerOrders: (user: User) => Promise<void>;
  loadSellerOrders: (sellerId: string) => Promise<void>;
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
    const order = await ordersApi.create({
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
    });
    set((state) => ({ orders: [order, ...state.orders] }));
    return order;
  }
}));

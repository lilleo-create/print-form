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
  async createOrder({ user, contactId, shippingAddressId, items, total }) {
    const order = await ordersApi.create({
      buyerId: user.id,
      buyerEmail: user.email,
      contactId,
      shippingAddressId,
      items,
      total
    });
    set((state) => ({ orders: [order, ...state.orders] }));
    return order;
  }
}));

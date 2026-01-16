import { create } from 'zustand';
import { ordersApi } from '../../shared/api/ordersApi';
import { Order, OrderItem, User } from '../../shared/types';

interface OrdersState {
  orders: Order[];
  loadOrders: (user: User) => Promise<void>;
  createOrder: (payload: { user: User; items: OrderItem[]; total: number }) => Promise<Order>;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  async loadOrders(user) {
    const data = await ordersApi.listByUser(user.id);
    set({ orders: data });
  },
  async createOrder({ user, items, total }) {
    const order = await ordersApi.create({
      userId: user.id,
      userEmail: user.email,
      items,
      total
    });
    set((state) => ({ orders: [order, ...state.orders] }));
    return order;
  }
}));

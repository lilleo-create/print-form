import { create } from 'zustand';
import { ordersApi } from '../../shared/api/ordersApi';
import { Order, OrderItem } from '../../shared/types';

interface OrdersState {
  orders: Order[];
  loadOrders: () => Promise<void>;
  createOrder: (items: OrderItem[], total: number) => Promise<Order>;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  async loadOrders() {
    const data = await ordersApi.list();
    set({ orders: data });
  },
  async createOrder(items, total) {
    const order = await ordersApi.create({ items, total });
    set((state) => ({ orders: [order, ...state.orders] }));
    return order;
  }
}));

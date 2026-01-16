import { Order, OrderItem } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const getOrders = () => loadFromStorage<Order[]>(STORAGE_KEYS.orders, []);

export const ordersApi = {
  listByUser: async (userId: string) => {
    const orders = getOrders();
    return orders.filter((order) => order.userId === userId);
  },
  create: async (payload: {
    userId: string;
    userEmail: string;
    items: OrderItem[];
    total: number;
  }) => {
    const current = getOrders();
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      userId: payload.userId,
      userEmail: payload.userEmail,
      status: 'processing',
      total: payload.total,
      createdAt: new Date().toISOString().split('T')[0],
      items: payload.items
    };
    const next = [newOrder, ...current];
    saveToStorage(STORAGE_KEYS.orders, next);
    return newOrder;
  }
};

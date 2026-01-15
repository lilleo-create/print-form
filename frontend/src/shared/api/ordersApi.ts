import { Order, OrderItem } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { orders as seedOrders } from './mockData';

const ORDERS_KEY = 'mock_orders';

const getSeededOrders = () => {
  const stored = loadFromStorage<Order[]>(ORDERS_KEY, []);
  if (stored.length > 0) {
    return stored;
  }
  saveToStorage(ORDERS_KEY, seedOrders);
  return seedOrders;
};

export const ordersApi = {
  list: async () => getSeededOrders(),
  create: async (payload: { items: OrderItem[]; total: number }) => {
    const current = getSeededOrders();
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      status: 'processing',
      total: payload.total,
      createdAt: new Date().toISOString().split('T')[0],
      items: payload.items
    };
    const next = [newOrder, ...current];
    saveToStorage(ORDERS_KEY, next);
    return newOrder;
  }
};

import { Order, OrderItem } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const getOrders = () => loadFromStorage<Order[]>(STORAGE_KEYS.orders, []);

export const ordersApi = {
  listByBuyer: async (buyerId: string) => {
    const orders = getOrders();
    return orders.filter((order) => order.buyerId === buyerId);
  },
  listBySeller: async (sellerId: string) => {
    const orders = getOrders();
    return orders.filter((order) => order.items.some((item) => item.sellerId === sellerId));
  },
  create: async (payload: {
    buyerId: string;
    buyerEmail: string;
    contactId: string;
    shippingAddressId: string;
    items: OrderItem[];
    total: number;
  }) => {
    const current = getOrders();
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      buyerId: payload.buyerId,
      buyerEmail: payload.buyerEmail,
      contactId: payload.contactId,
      shippingAddressId: payload.shippingAddressId,
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

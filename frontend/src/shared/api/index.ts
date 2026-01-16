import { createMockClient, filterProducts } from './mockAdapter';
import { createFetchClient } from './client';
import { Product, CustomPrintRequest, Order } from '../types';
import { products as seedProducts } from './mockData';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';
const client = useMock ? createMockClient() : createFetchClient(baseUrl);

export const api = {
  async getProducts(filters?: { category?: string; material?: string; price?: string; size?: string }) {
    if (useMock && filters) {
      const filtered = filterProducts(seedProducts, filters);
      return { data: filtered };
    }
    return client.request<Product[]>('/products');
  },
  async getProduct(id: string) {
    return client.request<Product>(`/products/${id}`);
  },
  async getFilters() {
    return client.request<{ categories: string[]; materials: string[]; sizes: string[] }>('/filters');
  },
  async sendCustomRequest(payload: Omit<CustomPrintRequest, 'id' | 'status'>) {
    return client.request<CustomPrintRequest>('/custom-requests', { method: 'POST', body: payload });
  },
  async getOrders() {
    return client.request<Order[]>('/me/orders');
  },
  async getSellerProducts() {
    return client.request<Product[]>('/seller/products');
  },
  async getSellerOrders() {
    return client.request<Order[]>('/seller/orders');
  },
  async login(payload: { email: string; password: string }) {
    return client.request<{ token: string; user: { name: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: payload
    });
  },
  async register(payload: { name: string; email: string; password: string }) {
    return client.request<{ token: string; user: { name: string; role: string } }>('/auth/register', {
      method: 'POST',
      body: payload
    });
  }
};

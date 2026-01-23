import { createMockClient, filterProducts } from './mockAdapter';
import { createFetchClient } from './client';
import { Product, CustomPrintRequest, Order, Review } from '../types';
import { products as seedProducts } from './mockData';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';
const client = useMock ? createMockClient() : createFetchClient(baseUrl);

export const api = {
  async getProducts(filters?: {
    category?: string;
    material?: string;
    price?: string;
    size?: string;
    sort?: 'createdAt' | 'rating';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    if (useMock) {
      let items = filterProducts(seedProducts, filters ?? {});
      if (filters?.sort === 'rating') {
        items = [...items].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
      } else if (filters?.sort === 'createdAt') {
        items = [...items].sort((a, b) => (b.id ?? '').localeCompare(a.id ?? ''));
      }
      return { data: items };
    }
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.material) params.set('material', filters.material);
    if (filters?.size) params.set('size', filters.size);
    if (filters?.price) {
      const [min, max] = filters.price.split('-');
      params.set('minPrice', min);
      params.set('maxPrice', max);
    }
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return client.request<Product[]>(`/products${query ? `?${query}` : ''}`);
  },
  async getProduct(id: string) {
    return client.request<Product>(`/products/${id}`);
  },
  async getProductReviews(
    id: string,
    page = 1,
    limit = 5,
    sort: 'helpful' | 'high' | 'low' | 'new' = 'new'
  ) {
    return client.request<{ data: Review[]; meta: { total: number } }>(
      `/products/${id}/reviews?page=${page}&limit=${limit}&sort=${sort}`
    );
  },
  async createReview(
    id: string,
    payload: { rating: number; pros: string; cons: string; comment: string; photos?: string[] }
  ) {
    return client.request<Review>(`/products/${id}/reviews`, { method: 'POST', body: payload });
  },
  async getReviewSummary(id: string) {
    return client.request<{
      data: { total: number; avg: number; counts: { rating: number; count: number }[]; photos: string[] };
    }>(`/products/${id}/reviews/summary`);
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
  async createSellerProduct(payload: Product) {
    return client.request<Product>('/seller/products', { method: 'POST', body: payload });
  },
  async updateSellerProduct(id: string, payload: Partial<Product>) {
    return client.request<Product>(`/seller/products/${id}`, { method: 'PUT', body: payload });
  },
  async removeSellerProduct(id: string) {
    return client.request<{ success: boolean }>(`/seller/products/${id}`, { method: 'DELETE' });
  },
  async getSellerOrders() {
    return client.request<Order[]>('/seller/orders');
  },
  async createOrder(payload: { items: { productId: string; variantId?: string; quantity: number }[] }) {
    return client.request<Order>('/orders', { method: 'POST', body: payload });
  },
  async login(payload: { email: string; password: string }) {
    return client.request<{
      token: string;
      user: { name: string; role: string; email: string; id: string; phone?: string | null; address?: string | null };
    }>(
      '/auth/login',
      {
        method: 'POST',
        body: payload
      }
    );
  },
  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }) {
    return client.request<{
      token: string;
      user: { name: string; role: string; email: string; id: string; phone?: string | null; address?: string | null };
    }>(
      '/auth/register',
      {
        method: 'POST',
        body: payload
      }
    );
  },
  async logout() {
    return client.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },
  async me() {
    return client.request<{ id: string; name: string; role: string; email: string; phone?: string | null; address?: string | null }>(
      '/auth/me'
    );
  },
  async updateProfile(payload: { name?: string; phone?: string; address?: string }) {
    return client.request<{
      data: { id: string; name: string; role: string; email: string; phone?: string | null; address?: string | null };
    }>('/auth/me', { method: 'PATCH', body: payload });
  }
};

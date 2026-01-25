import { createMockClient, filterProducts } from './mockAdapter';
import { createFetchClient } from './client';
import { Product, CustomPrintRequest, Order, Review, SellerProfile } from '../types';
import { products as seedProducts } from './mockData';
import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
const client = useMock ? createMockClient() : createFetchClient(baseUrl);
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export const api = {
  async getProducts(filters?: {
    category?: string;
    material?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
    ratingMin?: number;
    color?: string;
    sort?: 'createdAt' | 'rating';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    cursor?: string;
  }) {
    if (useMock) {
      let items = filterProducts(seedProducts, filters ?? {});
      if (filters?.sort === 'rating') {
        items = [...items].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
      } else if (filters?.sort === 'createdAt') {
        items = [...items].sort((a, b) => (b.id ?? '').localeCompare(a.id ?? ''));
      }
      if (filters?.order === 'asc') {
        items = [...items].reverse();
      }
      if (filters?.cursor) {
        const cursorIndex = items.findIndex((item) => item.id === filters.cursor);
        if (cursorIndex >= 0) {
          items = items.slice(cursorIndex + 1);
        }
      }
      if (filters?.limit) {
        items = items.slice(0, filters.limit);
      }
      return { data: items };
    }
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.material) params.set('material', filters.material);
    if (filters?.size) params.set('size', filters.size);
    if (filters?.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters?.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters?.q) params.set('q', filters.q);
    if (filters?.ratingMin !== undefined) params.set('ratingMin', String(filters.ratingMin));
    if (filters?.color) params.set('color', filters.color);
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.cursor) params.set('cursor', filters.cursor);
    const query = params.toString();
    return client.request<Product[]>(`/products${query ? `?${query}` : ''}`);
  },
  async getProduct(id: string) {
    return client.request<Product>(`/products/${id}`);
  },
  async getProductReviews(
    id: string,
    params: { page?: number; limit?: number; sort?: 'helpful' | 'rating_desc' | 'rating_asc' | 'new'; productIds?: string[] } = {}
  ) {
    if (useMock) {
      return { data: [] as Review[] };
    }
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.sort) query.set('sort', params.sort);
    if (params.productIds && params.productIds.length) {
      query.set('productIds', params.productIds.join(','));
    }
    return client.request<Review[]>(`/products/${id}/reviews?${query.toString()}`);
  },
  async createReview(id: string, payload: { rating: number; pros: string; cons: string; comment: string; photos?: string[] }) {
    if (useMock) {
      return {
        data: {
          id: `review-${Date.now()}`,
          rating: payload.rating,
          pros: payload.pros,
          cons: payload.cons,
          comment: payload.comment,
          photos: payload.photos ?? [],
          likesCount: 0,
          dislikesCount: 0,
          createdAt: new Date().toISOString(),
          user: { id: 'mock', name: 'Гость' }
        } as Review
      };
    }
    return client.request<Review>(`/products/${id}/reviews`, { method: 'POST', body: payload });
  },
  async getProductReviewsSummary(id: string, productIds?: string[]) {
    if (useMock) {
      return { data: { avg: 0, total: 0, distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 } } };
    }
    const query = new URLSearchParams();
    if (productIds && productIds.length) {
      query.set('productIds', productIds.join(','));
    }
    return client.request<{ avg: number; total: number; distribution: Record<string, number> }>(
      `/products/${id}/reviews/summary${query.toString() ? `?${query.toString()}` : ''}`
    );
  },
  async getFilters() {
    return client.request<{ categories: string[]; materials: string[]; sizes: string[]; colors: string[] }>('/filters');
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
  async createSellerProduct(payload: {
    title: string;
    price: number;
    material: string;
    category: string;
    size: string;
    technology: string;
    printTime: string;
    color: string;
    description: string;
    imageUrls: string[];
    deliveryDateEstimated?: string;
    deliveryDates?: string[];
  }) {
    return client.request<Product>('/seller/products', { method: 'POST', body: payload });
  },
  async updateSellerProduct(
    id: string,
    payload: {
      title?: string;
      price?: number;
      material?: string;
      category?: string;
      size?: string;
      technology?: string;
      printTime?: string;
      color?: string;
      description?: string;
      imageUrls?: string[];
      deliveryDateEstimated?: string;
      deliveryDates?: string[];
    }
  ) {
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
      user: { name: string; role: string; email: string; id: string; phone?: string; address?: string };
    }>(
      '/auth/login',
      {
        method: 'POST',
        body: payload
      }
    );
  },
  async register(payload: { name: string; email: string; password: string; phone: string; address: string }) {
    return client.request<{
      token: string;
      user: { name: string; role: string; email: string; id: string; phone?: string; address?: string };
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
    return client.request<{ id: string; name: string; role: string; email: string; phone?: string; address?: string }>(
      '/auth/me'
    );
  }
};

import { createMockClient, filterProducts } from './mockAdapter';
import { createFetchClient } from './client';
import { Product, CustomPrintRequest, Order, Review } from '../types';
import { products as seedProducts } from './mockData';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
const client = useMock ? createMockClient() : createFetchClient(baseUrl);

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
    page = 1,
    limit = 5,
    sort: 'helpful' | 'high' | 'low' | 'new' = 'new',
    productIds?: string[]
  ) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort
    });
    if (productIds && productIds.length > 0) {
      params.set('productIds', productIds.join(','));
    }
    return client.request<{ data: Review[]; meta: { total: number } }>(
      `/products/${id}/reviews?${params.toString()}`
    );
  },
  async createReview(
    id: string,
    payload: { rating: number; pros: string; cons: string; comment: string; photos?: string[] }
  ) {
    return client.request<Review>(`/products/${id}/reviews`, { method: 'POST', body: payload });
  },
  async getReviewSummary(id: string, productIds?: string[]) {
    const params = new URLSearchParams();
    if (productIds && productIds.length > 0) {
      params.set('productIds', productIds.join(','));
    }
    return client.request<{
      data: { total: number; avg: number; counts: { rating: number; count: number }[]; photos: string[] };
    }>(`/products/${id}/reviews/summary${params.toString() ? `?${params.toString()}` : ''}`);
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
    privacyAccepted?: boolean;
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
  async updateProfile(payload: { name?: string; email?: string; phone?: string; address?: string }) {
    return client.request<{
      data: { id: string; name: string; role: string; email: string; phone?: string | null; address?: string | null };
    }>('/auth/me', { method: 'PATCH', body: payload });
  },
  async getMyReviews() {
    return client.request<{ data: Review[] }>('/me/reviews');
  },
  async updateReviewVisibility(id: string, isPublic: boolean) {
    return client.request<{ data: Review }>(`/me/reviews/${id}/visibility`, {
      method: 'PATCH',
      body: { isPublic }
    });
  },
  async submitSellerOnboarding(payload: {
    name: string;
    phone: string;
    status: 'ИП' | 'ООО' | 'Самозанятый';
    storeName: string;
    city: string;
    referenceCategory: string;
    catalogPosition: string;
  }) {
    return client.request<{ data: { id: string; name: string; email: string; phone?: string | null; role: string } }>(
      '/seller/onboarding',
      { method: 'POST', body: payload }
    );
  }
};

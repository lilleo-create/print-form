import { createMockClient, filterProducts } from './mockAdapter';
import { createFetchClient } from './client';
import { Product, CustomPrintRequest, Order, Review, SellerProfile } from '../types';
import { products as seedProducts } from './mockData';
import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';
const client = useMock ? createMockClient() : createFetchClient(baseUrl);
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

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
    cursor?: string;
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
  },
  async getSellerProfile() {
    return client.request<{ isSeller: boolean; profile: SellerProfile | null }>('/seller/me');
  },
  async getSellerStats() {
    return client.request<{ totalOrders: number; totalRevenue: number; totalProducts: number; averageRating: number }>(
      '/seller/stats'
    );
  },
  async uploadSellerImages(files: FileList) {
    if (useMock) {
      return {
        data: {
          urls: Array.from(files).map(
            (file) => `https://placehold.co/600x400?text=${encodeURIComponent(file.name)}`
          )
        }
      };
    }
    const session = loadFromStorage<{ token: string } | null>(STORAGE_KEYS.session, null);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    const response = await fetch(`${baseUrl}/seller/uploads`, {
      method: 'POST',
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      body: formData
    });
    if (!response.ok) {
      throw new Error('UPLOAD_FAILED');
    }
    return response.json() as Promise<{ data: { urls: string[] } }>;
  }
};

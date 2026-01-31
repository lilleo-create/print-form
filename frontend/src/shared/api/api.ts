import { createFetchClient } from './client';
import type {
  Product,
  CustomPrintRequest,
  Order,
  Review,
  SellerProfile,
  SellerKycSubmission,
  PaymentIntent
} from '../types';
import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export interface ApiError {
  code?: string;
  message?: string;
  details?: unknown;
}

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const apiClient = createFetchClient(baseUrl);

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
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.material) params.set('material', filters.material);
    if (filters?.size) params.set('size', filters.size);
    if (filters?.price) {
      const [min, max] = filters.price.split('-');
      if (min) params.set('minPrice', min);
      if (max) params.set('maxPrice', max);
    }
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));

    const query = params.toString();
    return apiClient.request<Product[]>(`/products${query ? `?${query}` : ''}`);
  },

  async getProduct(id: string) {
    return apiClient.request<Product>(`/products/${id}`);
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
    return apiClient.request<{ data: Review[]; meta: { total: number } }>(
      `/products/${id}/reviews?${params.toString()}`
    );
  },

  async createReview(
    id: string,
    payload: { rating: number; pros: string; cons: string; comment: string; photos?: string[] }
  ) {
    return apiClient.request<Review>(`/products/${id}/reviews`, { method: 'POST', body: payload });
  },

  async getReviewSummary(id: string, productIds?: string[]) {
    const params = new URLSearchParams();
    if (productIds && productIds.length > 0) {
      params.set('productIds', productIds.join(','));
    }
    const qs = params.toString();
    return apiClient.request<{
      data: { total: number; avg: number; counts: { rating: number; count: number }[]; photos: string[] };
    }>(`/products/${id}/reviews/summary${qs ? `?${qs}` : ''}`);
  },

  async getFilters() {
    return apiClient.request<{ categories: string[]; materials: string[]; sizes: string[] }>('/filters');
  },

  async getReferenceCategories() {
    return apiClient.request<{ id: string; slug: string; title: string }[]>('/filters/reference-categories');
  },

  async sendCustomRequest(payload: Omit<CustomPrintRequest, 'id' | 'status'>) {
    return apiClient.request<CustomPrintRequest>('/custom-requests', { method: 'POST', body: payload });
  },

  async getOrders() {
    return apiClient.request<Order[]>('/me/orders');
  },

  async getSellerProducts() {
    return apiClient.request<Product[]>('/seller/products');
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
    return apiClient.request<Product>('/seller/products', { method: 'POST', body: payload });
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
    return apiClient.request<Product>(`/seller/products/${id}`, { method: 'PUT', body: payload });
  },

  async removeSellerProduct(id: string) {
    return apiClient.request<{ success: boolean }>(`/seller/products/${id}`, { method: 'DELETE' });
  },

  async getSellerOrders() {
    return apiClient.request<Order[]>('/seller/orders');
  },

  async createOrder(payload: {
    contactId?: string;
    shippingAddressId?: string;
    items: { productId: string; variantId?: string; quantity: number }[];
  }) {
    return apiClient.request<Order>('/orders', { method: 'POST', body: payload });
  },

  async login(payload: { email: string; password: string }) {
    return apiClient.request<{
      requiresOtp?: boolean;
      tempToken?: string;
      user?: { name: string; role: string; email: string; id: string; phone?: string | null; address?: string | null };
      accessToken?: string;
    }>('/auth/login', { method: 'POST', body: payload });
  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }) {
    return apiClient.request<{
      requiresOtp?: boolean;
      tempToken?: string;
      user?: { name: string; role: string; email: string; id: string; phone?: string | null; address?: string | null };
      accessToken?: string;
    }>('/auth/register', { method: 'POST', body: payload });
  },

  async requestOtp(
    payload: { phone: string; purpose?: 'login' | 'register' | 'seller_verify'; turnstileToken?: string },
    token?: string | null
  ) {
    return apiClient.request<{ ok: boolean; devOtp?: string }>('/auth/otp/request', {
      method: 'POST',
      body: payload,
      token
    });
  },

  async verifyOtp(
    payload: { phone: string; code: string; purpose?: 'login' | 'register' | 'seller_verify' },
    token?: string | null
  ) {
    return apiClient.request<{
      accessToken?: string;
      user?: { name: string; role: string; email: string; id: string; phone?: string | null; address?: string | null };
    }>('/auth/otp/verify', { method: 'POST', body: payload, token });
  },

  async logout() {
    return apiClient.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },

  async me() {
    return apiClient.request<{ id: string; name: string; role: string; email: string; phone?: string | null; address?: string | null }>(
      '/auth/me'
    );
  },

  async updateProfile(payload: { name?: string; email?: string; phone?: string; address?: string }) {
    return apiClient.request<{
      data: { id: string; name: string; role: string; email: string; phone?: string | null; address?: string | null };
    }>('/auth/me', { method: 'PATCH', body: payload });
  },

  async getMyReviews() {
    return apiClient.request<{ data: Review[] }>('/me/reviews');
  },

  async updateReviewVisibility(id: string, isPublic: boolean) {
    return apiClient.request<{ data: Review }>(`/me/reviews/${id}/visibility`, {
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
    return apiClient.request<{ data: { id: string; name: string; email: string; phone?: string | null; role: string } }>(
      '/seller/onboarding',
      { method: 'POST', body: payload }
    );
  },

  async getSellerProfile() {
    return apiClient.request<{ isSeller: boolean; profile: SellerProfile | null; kyc?: SellerKycSubmission | null; canSell?: boolean }>(
      '/seller/me'
    );
  },

  async getSellerStats() {
    return apiClient.request<{ totalOrders: number; totalRevenue: number; totalProducts: number; averageRating: number }>(
      '/seller/stats'
    );
  },

  async uploadSellerImages(files: FileList) {
    const session = loadFromStorage<{ token: string } | null>(STORAGE_KEYS.session, null);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await fetch(`${baseUrl}/seller/uploads`, {
      method: 'POST',
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) throw new Error('UPLOAD_FAILED');
    return response.json() as Promise<{ data: { urls: string[] } }>;
  },

  async getSellerKyc() {
    return apiClient.request<SellerKycSubmission | null>('/seller/kyc/me');
  },

  async submitSellerKyc() {
    return apiClient.request<SellerKycSubmission>('/seller/kyc/submit', { method: 'POST' });
  },

  async uploadSellerKycDocuments(files: FileList) {
    const session = loadFromStorage<{ token: string } | null>(STORAGE_KEYS.session, null);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await fetch(`${baseUrl}/seller/kyc/documents`, {
      method: 'POST',
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) throw new Error('UPLOAD_FAILED');
    return response.json() as Promise<{ data: { submissionId: string; documents: SellerKycSubmission['documents'] } }>;
  },

  async getAdminKyc() {
    return apiClient.request<SellerKycSubmission[]>('/admin/kyc');
  },

  async reviewAdminKyc(id: string, payload: { status: 'APPROVED' | 'REJECTED'; notes?: string }) {
    return apiClient.request<SellerKycSubmission>(`/admin/kyc/${id}`, { method: 'PATCH', body: payload });
  },

  async createPaymentIntent(payload: { orderId: string; amount: number; currency?: string; provider?: string }) {
    return apiClient.request<PaymentIntent>('/payments/intent', { method: 'POST', body: payload });
  }
};

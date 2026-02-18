import { createFetchClient } from './client';
import type {
  CustomPrintRequest,
  Order,
  OrderStatus,
  Payment,
  PaymentIntent,
  Product,
  Review,
  ReturnRequest,
  ReturnReason,
  ReturnStatus,
  SellerContextResponse,
  SellerDeliveryProfile,
  SellerKycSubmission,
  ChatThread,
  ChatMessage,
  Shop
} from '../types';
import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';


export type SellerDropoffStation = {
  id: string;
  operator_station_id: string | null;
  name: string | null;
  addressFull: string | null;
  geoId?: number | null;
  position: { latitude?: number; longitude?: number } | null;
  maxWeightGross?: number | null;
};

export interface ApiError {
  code?: string;
  message?: string;
  details?: unknown;
}

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const apiClient = createFetchClient(baseUrl);

type UploadResponse = { data: { urls: string[] } };

const normalizeUploadUrl = (u: string) => {
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return u;
  return `/${u}`;
};

const authHeaders = () => {
  const token = loadFromStorage<string | null>(STORAGE_KEYS.accessToken, null);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export const api = {
  async getProducts(
    filters?: {
      category?: string;
      material?: string;
      price?: string;
      size?: string;
      sort?: 'createdAt' | 'rating' | 'price';
      order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
      shopId?: string;
      q?: string;
      cursor?: string;
      signal?: AbortSignal;
    },
    opts?: { signal?: AbortSignal }
  ) {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.material) params.set('material', filters.material);
    if (filters?.size) params.set('size', filters.size);
    if (filters?.price) {
      const [min, max] = filters.price.split('-');
      if (min) params.set('minPrice', min);
      if (max) params.set('maxPrice', max);
    }
    if (filters?.shopId) params.set('shopId', filters.shopId);
    if (filters?.q) params.set('q', filters.q);
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));

    const query = params.toString();
    const signal = opts?.signal ?? filters?.signal;
    return apiClient.request<Product[]>(
      `/products${query ? `?${query}` : ''}`,
      { signal }
    );
  },

  async getShop(shopId: string, opts?: { signal?: AbortSignal }) {
    return apiClient.request<Shop>(`/shops/${shopId}`, {
      signal: opts?.signal
    });
  },

  async getShopFilters(shopId: string, opts?: { signal?: AbortSignal }) {
    return apiClient.request<{
      categories: string[];
      materials: string[];
      sizes: string[];
    }>(`/shops/${shopId}/filters`, { signal: opts?.signal });
  },

  async getProduct(id: string, opts?: { signal?: AbortSignal }) {
    return apiClient.request<Product>(`/products/${id}`, {
      signal: opts?.signal
    });
  },

  async getProductReviews(
    id: string,
    page = 1,
    limit = 5,
    sort: 'helpful' | 'high' | 'low' | 'new' = 'new',
    productIds?: string[],
    opts?: { signal?: AbortSignal }
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
      `/products/${id}/reviews?${params.toString()}`,
      { signal: opts?.signal }
    );
  },

  async createReview(
    id: string,
    payload: {
      rating: number;
      pros: string;
      cons: string;
      comment: string;
      photos?: string[];
    }
  ) {
    return apiClient.request<Review>(`/products/${id}/reviews`, {
      method: 'POST',
      body: payload
    });
  },

  async getReviewSummary(
    id: string,
    productIds?: string[],
    opts?: { signal?: AbortSignal }
  ) {
    const params = new URLSearchParams();
    if (productIds && productIds.length > 0) {
      params.set('productIds', productIds.join(','));
    }
    const qs = params.toString();
    return apiClient.request<{
      data: {
        total: number;
        avg: number;
        counts: { rating: number; count: number }[];
        photos: string[];
      };
    }>(`/products/${id}/reviews/summary${qs ? `?${qs}` : ''}`, {
      signal: opts?.signal
    });
  },

  async getFilters(opts?: { signal?: AbortSignal } | AbortSignal) {
    const signal = opts instanceof AbortSignal ? opts : opts?.signal;
    const categoriesResponse = await apiClient.request<
      { id: string; slug: string; title: string }[]
    >('/filters/reference-categories', { signal });
    return {
      data: {
        categories: categoriesResponse.data.map((category) => category.title),
        materials: [],
        sizes: []
      }
    };
  },

  async getReferenceCategories() {
    return apiClient.request<{ id: string; slug: string; title: string }[]>(
      '/filters/reference-categories'
    );
  },

  async getCities() {
    return apiClient.request<{ id: string; name: string }[]>('/filters/cities');
  },

  async sendCustomRequest(payload: Omit<CustomPrintRequest, 'id' | 'status'>) {
    return apiClient.request<CustomPrintRequest>('/custom-requests', {
      method: 'POST',
      body: payload
    });
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
    weightGrossG?: number;
    dxCm?: number;
    dyCm?: number;
    dzCm?: number;
    imageUrls: string[];
    videoUrls?: string[];
    deliveryDateEstimated?: string;
  }) {
    return apiClient.request<Product>('/seller/products', {
      method: 'POST',
      body: payload
    });
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
      weightGrossG?: number;
      dxCm?: number;
      dyCm?: number;
      dzCm?: number;
      imageUrls?: string[];
      videoUrls?: string[];
      deliveryDateEstimated?: string;
    }
  ) {
    return apiClient.request<Product>(`/seller/products/${id}`, {
      method: 'PUT',
      body: payload
    });
  },

  async removeSellerProduct(id: string) {
    return apiClient.request<{ success: boolean }>(`/seller/products/${id}`, {
      method: 'DELETE'
    });
  },

  async getSellerOrders(filters?: {
    status?: OrderStatus;
    offset?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    const query = params.toString();
    return apiClient.request<Order[]>(
      `/seller/orders${query ? `?${query}` : ''}`
    );
  },

  async updateSellerOrderStatus(
    id: string,
    payload: { status: OrderStatus; trackingNumber?: string; carrier?: string }
  ) {
    return apiClient.request<Order>(`/seller/orders/${id}/status`, {
      method: 'PATCH',
      body: payload
    });
  },

  async getSellerDeliveryProfile() {
    return apiClient.request<SellerDeliveryProfile | null>('/seller/settings');
  },


  async updateSourcePlatformStation(sourcePlatformStation: string) {
    return apiClient.request<SellerDeliveryProfile>(
      '/seller/settings/source-platform-station',
      {
        method: 'PUT',
        body: { source_platform_station: sourcePlatformStation }
      }
    );
  },


  async getSellerDropoffStations(
    geoIdOrParams: number | { geoId: number; limit?: number },
    limitArg?: number
  ) {
    const geoId =
      typeof geoIdOrParams === 'number' ? geoIdOrParams : geoIdOrParams.geoId;
    const limit =
      typeof geoIdOrParams === 'number'
        ? limitArg
        : geoIdOrParams.limit;

    const query = new URLSearchParams({ geoId: String(geoId) });
    if (limit) query.set('limit', String(limit));
    return apiClient.request<{ points: SellerDropoffStation[] }>(
      `/seller/ndd/dropoff-stations?${query.toString()}`
    );
  },

  async searchSellerDropoffStations(q: string, geoId = 213, limit = 20) {
    const query = new URLSearchParams({ q, geoId: String(geoId), limit: String(limit) });
    return apiClient.request<{ points: SellerDropoffStation[] }>(
      `/seller/ndd/dropoff-stations/search?${query.toString()}`
    );
  },



  async updateSellerDropoffStation(payload: {
    stationId: string;
    addressFull?: string;
    raw?: Record<string, unknown> | null;
    geoId?: number;
    query?: string;
    position?: { latitude?: number; longitude?: number } | null;
  }) {
    return apiClient.request<SellerDeliveryProfile>(
      '/seller/settings/dropoff-station',
      { method: 'PUT', body: payload }
    );
  },

  async updateSellerDeliveryProfile(payload: {
    dropoffPvz: {
      provider: 'YANDEX_NDD';
      pvzId: string;
      raw: Record<string, unknown> | null;
      addressFull?: string;
    };
  }) {
    return apiClient.request<SellerDeliveryProfile>(
      '/seller/settings/dropoff-pvz',
      { method: 'PUT', body: payload }
    );
  },

  async readyToShip(orderId: string) {
    return apiClient.request<{
      id: string;
      requestId?: string | null;
      status: string;
    }>(`/seller/orders/${orderId}/ready-to-ship`, {
      method: 'POST'
    });
  },

  async downloadShippingLabel(orderId: string) {
    const response = await fetch(
      `${baseUrl}/seller/orders/${orderId}/yandex/labels`,
      {
        method: 'POST',
        headers: {
          ...(authHeaders() ?? {})
        }
      }
    );
    if (!response.ok) {
      throw new Error(`LABEL_DOWNLOAD_FAILED_${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/pdf')) {
      return {
        type: 'pdf' as const,
        blob: await response.blob()
      };
    }
    const json = (await response.json()) as { data?: { url?: string | null } };
    return {
      type: 'url' as const,
      url: json.data?.url ?? null
    };
  },

  async downloadYandexHandoverAct(payload: {
    mode?: 'new_requests' | 'by_request_ids' | 'by_date_range';
    request_ids?: string[];
    editable_format?: boolean;
    created_since?: number;
    created_until?: number;
    created_since_utc?: string;
    created_until_utc?: string;
  }) {
    const response = await fetch(`${baseUrl}/seller/yandex/handover-act`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeaders() ?? {})
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`HANDOVER_ACT_DOWNLOAD_FAILED_${response.status}`);
    }
    return {
      blob: await response.blob(),
      contentType: response.headers.get('content-type') ?? 'application/pdf'
    };
  },

  async downloadSellerOrderDocument(
    orderId: string,
    type: 'packing-slip' | 'labels' | 'handover-act'
  ) {
    const response = await fetch(
      `${baseUrl}/seller/orders/${orderId}/documents/${type}.pdf`,
      {
        headers: {
          ...(authHeaders() ?? {})
        }
      }
    );
    if (!response.ok) {
      throw new Error(`ORDER_DOCUMENT_DOWNLOAD_FAILED_${response.status}`);
    }
    return await response.blob();
  },

  async getSellerPayments() {
    return apiClient.request<Payment[]>('/seller/payments');
  },

  async createOrder(payload: {
    contactId?: string;
    shippingAddressId?: string;
    items: { productId: string; variantId?: string; quantity: number }[];
  }) {
    return apiClient.request<Order>('/orders', {
      method: 'POST',
      body: payload
    });
  },

  async login(payload: { email: string; password: string }) {
    return apiClient.request<{
      requiresOtp?: boolean;
      tempToken?: string;
      user?: {
        name: string | null;
        role: string;
        email: string;
        id: string;
        phone?: string | null;
        address?: string | null;
      };
      accessToken?: string;
    }>('/auth/login', { method: 'POST', body: payload });
  },

  async register(payload: {
    name: string | null;
    email: string;
    password: string;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }) {
    return apiClient.request<{
      requiresOtp?: boolean;
      tempToken?: string;
      user?: {
        name: string | null;
        role: string;
        email: string;
        id: string;
        phone?: string | null;
        address?: string | null;
      };
      accessToken?: string;
    }>('/auth/register', { method: 'POST', body: payload });
  },

  async requestOtp(
    payload: {
      phone: string;
      purpose?: 'login' | 'register' | 'seller_verify';
      turnstileToken?: string;
    },
    token?: string | null
  ) {
    return apiClient.request<{ ok: boolean; devOtp?: string }>(
      '/auth/otp/request',
      {
        method: 'POST',
        body: payload,
        token
      }
    );
  },

  async verifyOtp(
    payload: {
      phone: string;
      code: string;
      purpose?: 'login' | 'register' | 'seller_verify';
    },
    token?: string | null
  ) {
    return apiClient.request<{
      accessToken?: string;
      user?: {
        name: string | null;
        role: string;
        email: string;
        id: string;
        phone?: string | null;
        address?: string | null;
      };
    }>('/auth/otp/verify', { method: 'POST', body: payload, token });
  },

  async logout() {
    return apiClient.request<{ success: boolean }>('/auth/logout', {
      method: 'POST'
    });
  },

  async requestPasswordReset(payload: { phone: string }) {
    return apiClient.request<{ ok: boolean; devOtp?: string }>(
      '/auth/password-reset/request',
      {
        method: 'POST',
        body: payload
      }
    );
  },

  async verifyPasswordReset(payload: { phone: string; code: string }) {
    return apiClient.request<{ ok: boolean; resetToken: string }>(
      '/auth/password-reset/verify',
      {
        method: 'POST',
        body: payload
      }
    );
  },

  async confirmPasswordReset(payload: { token: string; password: string }) {
    return apiClient.request<{ ok: boolean }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: payload
    });
  },

  async me() {
    return apiClient.request<{
      id: string;
      name: string | null;
      role: string;
      email: string;
    }>('/me');
  },

  async updateProfile(payload: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) {
    return apiClient.request<{
      data: {
        id: string;
        name: string | null;
        role: string;
        email: string;
        phone?: string | null;
        address?: string | null;
      };
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
    name: string | null;
    phone: string;
    status: 'ИП' | 'ООО' | 'Самозанятый';
    storeName: string;
    city: string;
    referenceCategory: string;
    catalogPosition: string;
  }) {
    return apiClient.request<{
      id: string;
      name: string | null;
      email: string;
      phone?: string | null;
      role: string;
    }>('/seller/onboarding', { method: 'POST', body: payload });
  },

  async getSellerContext(signal?: AbortSignal) {
    return apiClient.request<SellerContextResponse>('/seller/context', {
      signal
    });
  },

  async getSellerProfile() {
    return apiClient.request<SellerContextResponse>('/seller/context');
  },

  async getSellerStats() {
    return apiClient.request<{
      totalOrders: number;
      totalRevenue: number;
      totalProducts: number;
      statusCounts: Record<OrderStatus, number>;
    }>('/seller/stats');
  },

  // ✅ Upload images/videos to /seller/uploads (fetch-based)
  async uploadSellerImages(files: File[] | FileList) {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await fetch(`${baseUrl}/seller/uploads`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) throw new Error('UPLOAD_FAILED');

    const json = (await response.json()) as UploadResponse;
    return {
      data: { urls: (json.data.urls ?? []).map(normalizeUploadUrl) }
    } satisfies UploadResponse;
  },

  async getSellerKyc() {
    return apiClient.request<SellerKycSubmission | null>('/seller/kyc/me');
  },

  async submitSellerKyc(payload: {
    dropoffStationId: string;
    dropoffStationMeta?: Record<string, unknown>;
  }) {
    return apiClient.request<SellerKycSubmission>('/seller/kyc/submit', {
      method: 'POST',
      body: payload
    });
  },

  async uploadSellerKycDocuments(files: FileList) {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await fetch(`${baseUrl}/seller/kyc/documents`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) throw new Error('UPLOAD_FAILED');

    return response.json() as Promise<{
      data: {
        submissionId: string;
        documents: SellerKycSubmission['documents'];
      };
    }>;
  },

  async getAdminKyc(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
    return apiClient.request<SellerKycSubmission[]>(
      `/admin/kyc?status=${status}`
    );
  },

  async approveAdminKyc(id: string) {
    return apiClient.request<SellerKycSubmission>(`/admin/kyc/${id}/approve`, {
      method: 'POST'
    });
  },

  async rejectAdminKyc(id: string, payload: { notes?: string }) {
    return apiClient.request<SellerKycSubmission>(`/admin/kyc/${id}/reject`, {
      method: 'POST',
      body: payload
    });
  },

  async downloadAdminSellerDocument(id: string) {
    const response = await fetch(
      `${baseUrl}/admin/seller-documents/${id}/download`,
      {
        method: 'GET',
        headers: authHeaders(),
        credentials: 'include'
      }
    );
    if (!response.ok) {
      throw new Error('DOWNLOAD_FAILED');
    }
    const blob = await response.blob();
    const contentDisposition =
      response.headers.get('content-disposition') ?? '';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    const filename = filenameMatch?.[1];
    return { blob, filename };
  },

  async getAdminProducts(status: string = 'PENDING') {
    return apiClient.request<Product[]>(`/admin/products?status=${status}`);
  },

  async approveAdminProduct(id: string) {
    return apiClient.request<Product>(`/admin/products/${id}/approve`, {
      method: 'POST'
    });
  },

  async rejectAdminProduct(id: string, payload: { notes?: string }) {
    return apiClient.request<Product>(`/admin/products/${id}/reject`, {
      method: 'POST',
      body: payload
    });
  },

  async needsEditAdminProduct(id: string, payload: { notes?: string }) {
    return apiClient.request<Product>(`/admin/products/${id}/needs-edit`, {
      method: 'POST',
      body: payload
    });
  },

  async archiveAdminProduct(id: string) {
    return apiClient.request<Product>(`/admin/products/${id}`, {
      method: 'DELETE'
    });
  },

  async getAdminReviews(status: string = 'PENDING') {
    return apiClient.request<Review[]>(`/admin/reviews?status=${status}`);
  },

  async approveAdminReview(id: string) {
    return apiClient.request<Review>(`/admin/reviews/${id}/approve`, {
      method: 'POST'
    });
  },

  async rejectAdminReview(id: string, payload: { notes?: string }) {
    return apiClient.request<Review>(`/admin/reviews/${id}/reject`, {
      method: 'POST',
      body: payload
    });
  },

  async needsEditAdminReview(id: string, payload: { notes?: string }) {
    return apiClient.request<Review>(`/admin/reviews/${id}/needs-edit`, {
      method: 'POST',
      body: payload
    });
  },

  returns: {
    async listMy() {
      return apiClient.request<ReturnRequest[]>('/returns/my');
    },
    async create(payload: {
      orderItemId: string;
      reason: ReturnReason;
      comment?: string;
      photosUrls?: string[];
    }) {
      return apiClient.request<ReturnRequest>('/returns', {
        method: 'POST',
        body: payload
      });
    },
    async uploadPhotos(files: File[]) {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      return apiClient.request<{ urls: string[] }>('/returns/uploads', {
        method: 'POST',
        body: formData
      });
    }
  },

  chats: {
    async listMy() {
      return apiClient.request<{ active: ChatThread[]; closed: ChatThread[] }>(
        '/chats/my'
      );
    },
    async getThread(id: string) {
      return apiClient.request<{ thread: ChatThread; messages: ChatMessage[] }>(
        `/chats/${id}`
      );
    },
    async sendMessage(id: string, payload: { text: string }) {
      return apiClient.request<ChatMessage>(`/chats/${id}/messages`, {
        method: 'POST',
        body: payload
      });
    }
  },

  adminChats: {
    async listAll(query?: { status?: 'ACTIVE' | 'CLOSED'; q?: string }) {
      const params = new URLSearchParams();
      if (query?.status) {
        params.set('status', query.status);
      }
      if (query?.q) {
        params.set('q', query.q);
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return apiClient.request<{ active: ChatThread[]; closed: ChatThread[] }>(
        `/admin/chats${suffix}`
      );
    },
    async getThread(id: string) {
      return apiClient.request<{ thread: ChatThread; messages: ChatMessage[] }>(
        `/admin/chats/${id}`
      );
    },
    async sendMessage(id: string, payload: { text: string }) {
      return apiClient.request<ChatMessage>(`/admin/chats/${id}/messages`, {
        method: 'POST',
        body: payload
      });
    },
    async updateThreadStatus(
      id: string,
      payload: { status: 'ACTIVE' | 'CLOSED' }
    ) {
      return apiClient.request<ChatThread>(`/admin/chats/${id}`, {
        method: 'PATCH',
        body: payload
      });
    },
    async updateReturnStatus(
      id: string,
      payload: { status: ReturnStatus; adminComment?: string }
    ) {
      return apiClient.request<ReturnRequest>(`/admin/returns/${id}/status`, {
        method: 'PATCH',
        body: payload
      });
    }
  },

  async createPaymentIntent(payload: {
    orderId: string;
    amount: number;
    currency?: string;
    provider?: string;
  }) {
    return apiClient.request<PaymentIntent>('/payments/intent', {
      method: 'POST',
      body: payload
    });
  }
};

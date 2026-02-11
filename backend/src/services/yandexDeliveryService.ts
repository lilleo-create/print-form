import axios, { AxiosError, type AxiosInstance } from 'axios';

const TEST_HOST = 'https://b2b.taxi.tst.yandex.net';
const PROD_HOST = 'https://b2b-authproxy.taxi.yandex.net';

type RetryableConfig = {
  retries?: number;
  responseType?: 'arraybuffer';
  params?: Record<string, unknown>;
};

export type YaPvzSelection = {
  provider: 'YANDEX_NDD';
  pvzId: string;
  addressFull?: string;
  country?: string;
  locality?: string;
  street?: string;
  house?: string;
  comment?: string;
  raw: unknown;
};

class YandexDeliveryService {
  private readonly client: AxiosInstance;

  constructor() {
    const token = process.env.YD_TOKEN;
    if (!token) {
      throw new Error('YD_TOKEN_MISSING');
    }
    const env = process.env.YD_ENV === 'prod' ? 'prod' : 'test';
    const baseURL = env === 'prod' ? PROD_HOST : TEST_HOST;
    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === retries) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  async listPickupPoints(payload: Record<string, unknown>) {
    const { data } = await this.withRetry(() => this.client.post('/api/b2b/platform/pickup-points/list', payload));
    return data;
  }

  async createOffers(payload: Record<string, unknown>) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.post('/api/b2b/platform/offers/create?send_unix=true', payload)
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError<{ code?: string }>;
      if (axiosError.response?.status === 400 && axiosError.response.data?.code === 'no_delivery_options') {
        throw new Error('NO_DELIVERY_OPTIONS');
      }
      throw error;
    }
  }

  async confirmOffer(offerId: string) {
    const { data } = await this.withRetry(() =>
      this.client.post('/api/b2b/platform/offers/confirm', { offer_id: offerId })
    );
    return data;
  }

  async createRequest(payload: Record<string, unknown>) {
    const { data } = await this.withRetry(() =>
      this.client.post('/api/b2b/platform/request/create?send_unix=true', payload)
    );
    return data;
  }

  async getRequestInfo(requestId: string) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.get('/api/b2b/platform/request/info', { params: { request_id: requestId } })
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getRequestHistory(requestId: string) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.get('/api/b2b/platform/request/history', { params: { request_id: requestId } })
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getActualInfo(requestId: string) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.get('/api/b2b/platform/request/actual_info', { params: { request_id: requestId } })
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async cancelRequest(requestId: string) {
    const { data } = await this.withRetry(() => this.client.post('/api/b2b/platform/request/cancel', { request_id: requestId }));
    return data;
  }

  async generateLabels(requestIds: string[], generateType: 'one' | 'many' = 'one', language = 'ru') {
    const response = await this.withRetry(() =>
      this.client.post('/api/b2b/platform/request/generate-labels', {
        request_ids: requestIds,
        generate_type: generateType,
        language
      }, { responseType: 'arraybuffer' })
    );

    return {
      buffer: Buffer.from(response.data),
      contentType: String(response.headers['content-type'] ?? 'application/pdf')
    };
  }

  async getHandoverAct(params: Record<string, unknown>, body?: Record<string, unknown>) {
    const response = await this.withRetry(() =>
      this.client.post('/api/b2b/platform/request/get-handover-act', body ?? {}, { params, responseType: 'arraybuffer' })
    );

    return {
      buffer: Buffer.from(response.data),
      contentType: String(response.headers['content-type'] ?? 'application/pdf')
    };
  }
}

export const yandexDeliveryService = new YandexDeliveryService();

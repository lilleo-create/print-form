import axios, { type AxiosInstance, type ResponseType } from 'axios';
import { getYandexNddConfig } from '../../config/yandexNdd';
import { mapYandexError } from './errors';

export type RequestMeta = {
  requestId?: string;
  sellerId?: string;
  orderId?: string;
};

export class YandexDeliveryClient {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getYandexNddConfig();
    const token = String(config.token ?? '').trim().replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('YD_TOKEN_MISSING');

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': config.lang ?? 'ru',
      },
    });
  }

  async get<T>(path: string, params?: Record<string, unknown>, meta?: RequestMeta, responseType?: ResponseType): Promise<T> {
    return this.call<T>('GET', path, undefined, params, meta, responseType);
  }

  async post<T>(path: string, body?: unknown, params?: Record<string, unknown>, meta?: RequestMeta, responseType?: ResponseType): Promise<T> {
    return this.call<T>('POST', path, body, params, meta, responseType);
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, params?: Record<string, unknown>, meta?: RequestMeta, responseType?: ResponseType): Promise<T> {
    const started = Date.now();
    try {
      const response = await this.client.request<T>({ method, url: path, data: body, params, responseType });
      this.log(method, path, response.status, Date.now() - started, meta);
      return response.data;
    } catch (error) {
      const mapped = mapYandexError(error);
      this.log(method, path, mapped.httpStatus, Date.now() - started, meta, mapped.code, mapped.message);
      throw mapped;
    }
  }

  private log(method: string, endpoint: string, status: number, durationMs: number, meta?: RequestMeta, yandexErrorCode?: string, yandexErrorMessage?: string) {
    console.info('[YANDEX_DELIVERY]', {
      method,
      endpoint,
      requestId: meta?.requestId,
      sellerId: meta?.sellerId,
      orderId: meta?.orderId,
      status,
      durationMs,
      yandexErrorCode: yandexErrorCode ?? null,
      yandexErrorMessage: yandexErrorMessage ?? null,
    });
  }
}

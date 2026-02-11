import { getYandexNddConfig } from '../../config/yandexNdd';

type JsonRecord = Record<string, unknown>;

export class YandexNddHttpError extends Error {
  status: number;
  raw: string;

  constructor(message: string, status: number, raw: string) {
    super(message);
    this.name = 'YandexNddHttpError';
    this.status = status;
    this.raw = raw;
  }
}

export class YandexNddClient {
  private readonly config = getYandexNddConfig();

  private async request<T>(path: string, init?: RequestInit & { requestId?: string }): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'Accept-Language': this.config.lang,
        ...(init?.headers ?? {})
      }
    });

    const bodyText = await response.text();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[YANDEX_NDD]', { requestId: init?.requestId ?? 'n/a', path, httpStatus: response.status });
    }

    if (!response.ok) {
      throw new YandexNddHttpError(`NDD request failed: ${path}`, response.status, bodyText);
    }

    if (!bodyText) {
      return {} as T;
    }

    return JSON.parse(bodyText) as T;
  }

  offersCreate(body: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/offers/create', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  offersConfirm(body: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/offers/confirm', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  requestCreate(body: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/request/create', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  requestInfo(requestId: string) {
    return this.request<JsonRecord>(`/api/b2b/platform/request/info?request_id=${encodeURIComponent(requestId)}`, {
      method: 'GET',
      requestId
    });
  }

  requestHistory(requestId: string) {
    return this.request<JsonRecord>(`/api/b2b/platform/request/history?request_id=${encodeURIComponent(requestId)}`, {
      method: 'GET',
      requestId
    });
  }

  generateLabels(requestIds: string[]) {
    return this.request<JsonRecord>('/api/b2b/platform/request/generate-labels', {
      method: 'POST',
      body: JSON.stringify({ request_ids: requestIds })
    });
  }

  requestCancel(body: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/request/cancel', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export const yandexNddClient = new YandexNddClient();

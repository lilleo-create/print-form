import { getYandexNddConfig } from '../../config/yandexNdd';

type JsonRecord = Record<string, unknown>;

export class YandexNddHttpError extends Error {
  code: string;
  path: string;
  status: number;
  raw: string;
  details: unknown;

  constructor(code: string, path: string, status: number, raw: string, details: unknown) {
    super(code);
    this.name = 'YandexNddHttpError';
    this.code = code;
    this.path = path;
    this.status = status;
    this.raw = raw;
    this.details = details;
  }
}

export class YandexNddClient {
  private readonly config = getYandexNddConfig();

  private getAuthTokenMeta() {
    const rawToken = (this.config.token ?? '').trim();
    const hasBearerPrefix = /^Bearer\s+/i.test(rawToken);
    const normalizedToken = rawToken.replace(/^Bearer\s+/i, '').trim();

    return {
      hasBearerPrefix,
      normalizedToken,
      tokenLength: normalizedToken.length,
      tokenPreview: normalizedToken.slice(0, 10)
    };
  }

  private async request<T>(path: string, init?: RequestInit & { requestId?: string }): Promise<T> {
    const tokenMeta = this.getAuthTokenMeta();
    const headers = new Headers(init?.headers ?? {});
    headers.set('Authorization', `Bearer ${tokenMeta.normalizedToken}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept-Language', this.config.lang);

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers
    });

    const bodyText = await response.text();
    const errorDetails = (() => {
      if (!bodyText) return null;
      try {
        return JSON.parse(bodyText) as unknown;
      } catch {
        return bodyText;
      }
    })();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[YANDEX_NDD]', {
        requestId: init?.requestId ?? 'n/a',
        path,
        httpStatus: response.status,
        tokenPreview: tokenMeta.tokenPreview,
        tokenLength: tokenMeta.tokenLength,
        hasBearerPrefix: tokenMeta.hasBearerPrefix
      });
    }

    if (!response.ok) {
      console.error('[YANDEX_NDD] non-2xx response', {
        requestId: init?.requestId ?? 'n/a',
        path,
        httpStatus: response.status,
        tokenPreview: tokenMeta.tokenPreview,
        tokenLength: tokenMeta.tokenLength,
        hasBearerPrefix: tokenMeta.hasBearerPrefix,
        body: errorDetails
      });

      const code = path === '/api/b2b/platform/offers/create' ? 'NDD_OFFER_CREATE_FAILED' : 'NDD_REQUEST_FAILED';
      throw new YandexNddHttpError(code, path, response.status, bodyText, errorDetails);
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

import { getYandexNddConfig } from '../../config/yandexNdd';

type JsonRecord = Record<string, unknown>;

type DropoffStation202Item = {
  stationId: string;
  maxWeightGross: number | null;
};

type SmartCaptchaDetails = {
  uniqueKey?: string;
  hintUrl?: string;
};

type CacheEntry = {
  expiresAt: number;
  value: JsonRecord;
};

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

const OFFERS_INFO_CACHE_TTL_MS = 180_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number) => status === 429 || status >= 500;

const extractSmartCaptchaDetails = (bodyText: string): SmartCaptchaDetails => {
  const uniqueKeyPatterns = [
    /uniqueKey\s*[:=]\s*["']?([A-Za-z0-9_-]{6,})/i,
    /unique[_-]?key["'\s:=>]+([A-Za-z0-9_-]{6,})/i,
    /\bkey=([A-Za-z0-9_-]{6,})/i
  ];

  const uniqueKey = uniqueKeyPatterns
    .map((pattern) => bodyText.match(pattern)?.[1])
    .find((candidate) => Boolean(candidate));

  const hintUrl = bodyText.match(/https?:\/\/[^"'\s<]+/i)?.[0];

  return {
    ...(uniqueKey ? { uniqueKey } : {}),
    ...(hintUrl ? { hintUrl } : {})
  };
};


const toSnakeCaseKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();

const toSnakeCaseDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => toSnakeCaseDeep(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, nested]) => {
    acc[toSnakeCaseKey(key)] = toSnakeCaseDeep(nested);
    return acc;
  }, {});
};
const isHtmlBody = (contentType: string | null, bodyText: string) => {
  const normalized = bodyText.trimStart();
  return (
    (contentType ?? '').toLowerCase().includes('text/html') ||
    normalized.startsWith('<!DOCTYPE html') ||
    normalized.startsWith('<html')
  );
};

export class YandexNddClient {
  private readonly config = getYandexNddConfig();
  private readonly offersInfoCache = new Map<string, CacheEntry>();

  private getAuthTokenMeta() {
    const rawToken = (process.env.YANDEX_NDD_TOKEN ?? this.config.token ?? '').trim();
    const tokenWithoutPrefix = rawToken.replace(/^Bearer\s+/i, '').trim();
    const authHeader = `Bearer ${tokenWithoutPrefix}`;

    return {
      authHeader,
      tokenLength: tokenWithoutPrefix.length
    };
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (!normalizedPath.startsWith('/api/b2b/platform/')) {
      throw new Error(`NDD_INVALID_PATH:${normalizedPath}`);
    }
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`;
    return new URL(normalizedPath.slice(1), base).toString();
  }

  private async performRequest<T>(
    path: string,
    tokenMeta: ReturnType<YandexNddClient['getAuthTokenMeta']>,
    init?: RequestInit & { requestId?: string }
  ): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    headers.set('Authorization', tokenMeta.authHeader);
    headers.set('Accept', 'application/json');
    headers.set('Accept-Language', this.config.lang);
    headers.set('User-Agent', 'print-form-backend/1.0');
    if (init?.body) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(this.buildUrl(path), {
      ...init,
      headers
    });

    const bodyText = await response.text();
    const contentType = response.headers.get('content-type');

    if (isHtmlBody(contentType, bodyText)) {
      const details = extractSmartCaptchaDetails(bodyText);
      throw new YandexNddHttpError('YANDEX_SMARTCAPTCHA_BLOCK', path, response.status, bodyText, details);
    }

    const errorDetails = (() => {
      if (!bodyText) return null;
      try {
        return JSON.parse(bodyText) as unknown;
      } catch {
        return bodyText;
      }
    })();

    if (!response.ok) {
      const code = path === '/api/b2b/platform/offers/create' ? 'NDD_OFFER_CREATE_FAILED' : 'NDD_REQUEST_FAILED';
      throw new YandexNddHttpError(code, path, response.status, bodyText, errorDetails);
    }

    if (!bodyText) {
      return {} as T;
    }

    return JSON.parse(bodyText) as T;
  }

  private async request<T>(path: string, init?: RequestInit & { requestId?: string }): Promise<T> {
    const tokenMeta = this.getAuthTokenMeta();

    console.info('[YANDEX_NDD][auth]', { tokenLength: tokenMeta.tokenLength });

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.performRequest<T>(path, tokenMeta, init);
        if (process.env.NODE_ENV !== 'production') {
          console.log('[YANDEX_NDD]', {
            requestId: init?.requestId ?? 'n/a',
            path,
            httpStatus: 200,
            attempt
          });
        }
        return response;
      } catch (error) {
        if (!(error instanceof YandexNddHttpError)) {
          throw error;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[YANDEX_NDD]', {
            requestId: init?.requestId ?? 'n/a',
            path,
            httpStatus: error.status,
            attempt
          });
        }

        const retryable =
          error.code !== 'YANDEX_SMARTCAPTCHA_BLOCK' &&
          error.status !== 403 &&
          shouldRetryStatus(error.status) &&
          attempt < maxAttempts;

        if (!retryable) {
          console.error('[YANDEX_NDD] non-2xx response', {
            requestId: init?.requestId ?? 'n/a',
            path,
            httpStatus: error.status,
            tokenLength: tokenMeta.tokenLength,
            body: error.details
          });
          throw error;
        }

        const backoffMs = 250 * 2 ** (attempt - 1);
        const jitterMs = Math.floor(Math.random() * 150);
        await wait(backoffMs + jitterMs);
      }
    }

    throw new Error('NDD_REQUEST_RETRY_EXHAUSTED');
  }

  async offersCreate(body: JsonRecord) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD offers/create body]', JSON.stringify(body));
    }

    const response = await this.request<JsonRecord>('/api/b2b/platform/offers/create', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD offers/create response]', JSON.stringify(response));
    }

    return response;
  }

  async offersInfo(stationId: string, selfPickupId: string, lastMilePolicy = 'time_interval', sendUnix = true) {
    const query = new URLSearchParams({
      station_id: stationId,
      self_pickup_id: selfPickupId,
      last_mile_policy: lastMilePolicy,
      send_unix: String(sendUnix)
    });
    const cacheKey = `offersInfo:${stationId}:${selfPickupId}:${lastMilePolicy}`;
    const cached = this.offersInfoCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD offers/info params]', Object.fromEntries(query.entries()));
    }

    const response = await this.request<JsonRecord>(`/api/b2b/platform/offers/info?${query.toString()}`, {
      method: 'GET'
    });

    this.offersInfoCache.set(cacheKey, {
      expiresAt: Date.now() + OFFERS_INFO_CACHE_TTL_MS,
      value: response
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD offers/info response]', JSON.stringify(response));
    }

    return response;
  }

  async offersConfirm(body: JsonRecord) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD offers/confirm body]', JSON.stringify(body));
    }

    const response = await this.request<JsonRecord>('/api/b2b/platform/offers/confirm', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[NDD offers/confirm response]', JSON.stringify(response));
    }

    return response;
  }


  async pickupPointsList(body: JsonRecord = {}) {
    const payload = toSnakeCaseDeep(body) as JsonRecord;
    return this.request<{ points: any[] }>('/api/b2b/platform/pickup-points/list', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async locationDetect(body: { location: string }) {
    const payload = toSnakeCaseDeep(body) as JsonRecord;
    return this.request<{ variants?: Array<{ geo_id?: number; geoId?: number; address?: string }> }>(
      '/api/b2b/platform/location/detect',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  async detectGeoIdByQuery(location: string): Promise<number | null> {
    const response = await this.locationDetect({ location });
    const variants =
      ((response as any)?.variants ??
        (response as any)?.result?.variants ??
        []) as Array<{ geo_id?: number; geoId?: number }>;
    const firstVariant = variants[0];
    const rawGeoId = firstVariant?.geo_id ?? firstVariant?.geoId ?? null;
    if (typeof rawGeoId !== 'number' || !Number.isFinite(rawGeoId) || rawGeoId <= 0) {
      return null;
    }
    return rawGeoId;
  }

  async getNearestDropoffStations202(
    coords: { latitude: number; longitude: number },
    limit = 20,
    weightGross?: number
  ): Promise<DropoffStation202Item[]> {
    const payload = toSnakeCaseDeep({
      lat: coords.latitude,
      lon: coords.longitude,
      limit,
      ...(typeof weightGross === 'number' ? { weightGross } : {})
    }) as JsonRecord;

    const response = await this.request<JsonRecord>('/api/b2b/platform/stations/closest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const rawStations =
      (response as any)?.stations ??
      (response as any)?.result?.stations ??
      (response as any)?.station_ids ??
      (response as any)?.result?.station_ids ??
      [];

    const normalized = (Array.isArray(rawStations) ? rawStations : [])
      .map((item: any) => {
        if (typeof item === 'string') {
          return { stationId: item, maxWeightGross: null };
        }

        const stationIdRaw =
          item?.station_id ??
          item?.stationId ??
          item?.id ??
          item?.operator_station_id ??
          null;

        const stationId = typeof stationIdRaw === 'string' ? stationIdRaw.trim() : '';
        if (!stationId) {
          return null;
        }

        const maxWeightRaw = item?.max_weight_gross ?? item?.maxWeightGross ?? null;
        const maxWeightGross =
          typeof maxWeightRaw === 'number' && Number.isFinite(maxWeightRaw) ? maxWeightRaw : null;

        return {
          stationId,
          maxWeightGross
        };
      })
      .filter((item: DropoffStation202Item | null): item is DropoffStation202Item => Boolean(item));

    return normalized;
  }

  requestCreate(body: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/request/create', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  requestInfo(requestId: string) {
    const query = new URLSearchParams({ request_id: requestId });
    return this.request<JsonRecord>(`/api/b2b/platform/request/info?${query.toString()}`);
  }

  requestHistory(requestId: string) {
    const query = new URLSearchParams({ request_id: requestId });
    return this.request<JsonRecord>(`/api/b2b/platform/request/history?${query.toString()}`);
  }

  requestCancel(requestId: string) {
    return this.request<JsonRecord>('/api/b2b/platform/request/cancel', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId })
    });
  }

  requestCancelInfo(requestId: string) {
    const query = new URLSearchParams({ request_id: requestId });
    return this.request<JsonRecord>(`/api/b2b/platform/request/cancel_info?${query.toString()}`);
  }

  generateLabels(requestIds: string[]) {
    return this.request<JsonRecord>('/api/b2b/platform/request/generate-labels', {
      method: 'POST',
      body: JSON.stringify({ request_ids: requestIds })
    });
  }

  getLabels(payload: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/request/get-labels', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  actualInfo(requestId: string) {
    const query = new URLSearchParams({ request_id: requestId });
    return this.request<JsonRecord>(`/api/b2b/platform/request/actual_info?${query.toString()}`);
  }

  listRequests(payload: JsonRecord) {
    return this.request<JsonRecord>('/api/b2b/platform/request/list', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

export const yandexNddClient = new YandexNddClient();

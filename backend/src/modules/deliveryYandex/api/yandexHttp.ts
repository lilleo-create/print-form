/**
 * HTTP client for Yandex B2B platform. Single place for baseURL, headers, timeout, retries.
 */

import { getYandexNddConfig } from '../../../config/yandexNdd';
import { ENDPOINTS } from './endpoints';
import { mapYandexError } from '../domain/errors';

export type YandexHttpRequest = {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string>;
};

export type YandexHttpResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error: ReturnType<typeof mapYandexError> };

const TIMEOUT_MS = 15_000;
const RETRY_STATUSES = [429, 500, 502, 503];
const MAX_ATTEMPTS = 3;

function getAuthHeader(): string {
  const config = getYandexNddConfig();
  const raw = (config.token ?? '').trim().replace(/^Bearer\s+/i, '');
  return raw ? `Bearer ${raw}` : '';
}

function buildUrl(path: string, query?: Record<string, string>): string {
  const config = getYandexNddConfig();
  const base = config.baseUrl.replace(/\/+$/, '');
  const pathNorm = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(pathNorm, base);
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
}

export async function yandexHttp<T>(request: YandexHttpRequest): Promise<YandexHttpResult<T>> {
  const url = buildUrl(request.path, request.query);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': getYandexNddConfig().lang ?? 'ru',
    'Content-Type': 'application/json',
    'User-Agent': 'print-form-backend/1.0',
  };
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;

  let lastStatus = 0;
  let lastBody: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatus = response.status;
      const text = await response.text();
      let data: unknown = null;
      const contentType = response.headers.get('content-type') ?? '';
      if (text && contentType.includes('application/json')) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          lastBody = text;
        }
      } else {
        lastBody = text;
      }

      if (response.ok) {
        return { ok: true, data: (data ?? {}) as T, status: response.status };
      }

      lastBody = data ?? text;
      const doRetry = RETRY_STATUSES.includes(response.status) && attempt < MAX_ATTEMPTS;
      if (!doRetry) {
        const error = mapYandexError(response.status, lastBody, request.path);
        return { ok: false, status: response.status, error };
      }

      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          status: 0,
          error: mapYandexError(0, { message }, request.path),
        };
      }
    }
  }

  return {
    ok: false,
    status: lastStatus,
    error: mapYandexError(lastStatus, lastBody, request.path),
  };
}

export { ENDPOINTS };

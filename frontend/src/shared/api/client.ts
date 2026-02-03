import { loadFromStorage, removeFromStorage, setAccessToken } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export type ApiResponse<T> = { data: T };
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let refreshPromise: Promise<string | null> | null = null;

const readAccessToken = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  if ('accessToken' in payload && typeof payload.accessToken === 'string') {
    return payload.accessToken;
  }
  if ('token' in payload && typeof payload.token === 'string') {
    return payload.token;
  }
  if (
    'data' in payload &&
    typeof payload.data === 'object' &&
    payload.data !== null &&
    'accessToken' in payload.data &&
    typeof (payload.data as { accessToken?: unknown }).accessToken === 'string'
  ) {
    return (payload.data as { accessToken: string }).accessToken;
  }
  return null;
};

const logoutAndRedirect = () => {
  removeFromStorage(STORAGE_KEYS.session);
  setAccessToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
    window.location.assign('/auth/login');
  }
};

export function createFetchClient(baseUrl: string) {
  const refreshAccessToken = async (): Promise<string | null> => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });

    if (res.status === 204) {
      return null;
    }

    const ct = res.headers.get('content-type') ?? '';
    const payload = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const error = new Error('Refresh failed') as Error & { status?: number; payload?: unknown };
      error.status = res.status;
      error.payload = payload;
      throw error;
    }

    const token = readAccessToken(payload);
    if (token) {
      setAccessToken(token);
    }
    return token;
  };

  const request = async <T>(
    path: string,
    opts?: {
      method?: string;
      body?: unknown;
      token?: string | null;
      headers?: Record<string, string>;
      signal?: AbortSignal;
      retry?: boolean;
    }
  ): Promise<ApiResponse<T>> => {
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      ...(opts?.headers ?? {})
    };

    if (
      !headers['Content-Type'] &&
      opts?.body !== undefined &&
      !(opts.body instanceof FormData)
    ) {
      headers['Content-Type'] = 'application/json';
    }

    const storedToken = loadFromStorage<string | null>(
      STORAGE_KEYS.accessToken,
      null
    );
    const authToken = opts?.token ?? storedToken;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers,
      body:
        opts?.body === undefined
          ? undefined
          : opts.body instanceof FormData
            ? opts.body
            : JSON.stringify(opts.body),
      credentials: 'include',
      signal: opts?.signal
    });

    // 204 No Content
    if (res.status === 204) {
      return { data: undefined as unknown as T };
    }

    let payload: unknown;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }

    if (res.status === 401 && !opts?.retry && path !== '/auth/refresh') {
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        if (newToken) {
          return request<T>(path, { ...opts, token: newToken, retry: true });
        }
        logoutAndRedirect();
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) {
          logoutAndRedirect();
        }
        throw error;
      }
    }

    if (!res.ok) {
      let payload: unknown = null;

      try {
        payload = await res.json();
      } catch {
        // тело может быть пустым (401 / 204 / HTML)
      }

      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(
              (payload as { message?: unknown }).message ?? `HTTP ${res.status}`
            )
          : `HTTP ${res.status}`;

      const error = new Error(message) as Error & {
        status?: number;
        payload?: unknown;
      };

      error.status = res.status;
      error.payload = payload;

      throw error;
    }

    // ✅ Нормализация: всегда возвращаем { data: ... }
    // Если бэк уже вернул {data: ...}, не трогаем.
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
      return payload as ApiResponse<T>;
    }

    return { data: payload as T };
  };

  return { request };
}

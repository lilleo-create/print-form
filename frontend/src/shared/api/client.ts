import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export type ApiResponse<T> = { data: T };

export function createFetchClient(baseUrl: string) {
  const request = async <T>(
    path: string,
    opts?: {
      method?: string;
      body?: unknown;
      token?: string | null;
      headers?: Record<string, string>;
      signal?: AbortSignal;
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

    if (!res.ok) {
      const msg =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(
              (payload as { message?: unknown }).message ?? 'Request failed'
            )
          : 'Request failed';

      const error = new Error(msg) as Error & { status?: number; payload?: unknown };
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

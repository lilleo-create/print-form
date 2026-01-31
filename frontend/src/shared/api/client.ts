export type ApiResponse<T> = { data: T };

export function createFetchClient(baseUrl: string) {
  const request = async <T>(
    path: string,
    opts?: {
      method?: string;
      body?: unknown;
      token?: string | null;
      headers?: Record<string, string>;
    }
  ): Promise<ApiResponse<T>> => {
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      ...(opts?.headers ?? {})
    };

    if (!headers['Content-Type'] && opts?.body !== undefined && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (opts?.token) {
      headers.Authorization = `Bearer ${opts.token}`;
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
      credentials: 'include'
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
      // попытка вытащить норм message
      const msg =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message?: unknown }).message ?? 'Request failed')
          : 'Request failed';

      throw new Error(msg);
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

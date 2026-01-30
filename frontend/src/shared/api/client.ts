import { loadFromStorage, removeFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export interface ApiResponse<T> {
  data: T;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiClient {
  request<T>(
    path: string,
    options?: { method?: HttpMethod; body?: unknown; token?: string | null }
  ): Promise<ApiResponse<T>>;
}

export const createFetchClient = (baseUrl: string): ApiClient => {
  let refreshPromise: Promise<string | null> | null = null;

  const refreshToken = async () => {
    if (!refreshPromise) {
      refreshPromise = fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('UNAUTHORIZED');
          }
          const payload = (await response.json()) as { token?: string };
          return payload.token ?? null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  };

  return {
    async request<T>(
      path: string,
      options: { method?: HttpMethod; body?: unknown; token?: string | null } = {}
    ) {
      const session = loadFromStorage<{ token: string } | null>(STORAGE_KEYS.session, null);

      const doRequest = async (token: string | null, retry = false): Promise<ApiResponse<T>> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${baseUrl}${path}`, {
          method: options.method ?? 'GET',
          headers,
          credentials: 'include',
          body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (response.status === 401 && !retry && token) {
          try {
            const newToken = await refreshToken();
            if (newToken) {
              const current = loadFromStorage<{ token: string; user?: unknown } | null>(STORAGE_KEYS.session, null);
              if (current) {
                saveToStorage(STORAGE_KEYS.session, { ...current, token: newToken });
              }
              return doRequest(newToken, true);
            }
          } catch {
            removeFromStorage(STORAGE_KEYS.session);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('auth:logout'));
            }
          }
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const code = (payload as { error?: { code?: string } } | null)?.error?.code ?? response.status.toString();
          throw new Error(code);
        }
        return payload as ApiResponse<T>;
      };

      const authToken = options.token ?? session?.token ?? null;
      return doRequest(authToken, false);
    }
  };
};

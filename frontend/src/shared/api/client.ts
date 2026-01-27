import { loadFromStorage } from '../lib/storage';
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
  return {
    async request<T>(
      path: string,
      options: { method?: HttpMethod; body?: unknown; token?: string | null } = {}
    ) {
      const session = loadFromStorage<{ token: string } | null>(STORAGE_KEYS.session, null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authToken = options.token ?? session?.token;
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const code = (payload as { error?: { code?: string } } | null)?.error?.code ?? 'API_ERROR';
        throw new Error(code);
      }
      return payload as ApiResponse<T>;
    }
  };
};

import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export interface ApiResponse<T> {
  data: T;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiClient {
  request<T>(path: string, options?: { method?: HttpMethod; body?: unknown }): Promise<ApiResponse<T>>;
}

export const createFetchClient = (baseUrl: string): ApiClient => {
  return {
    async request<T>(path: string, options: { method?: HttpMethod; body?: unknown } = {}) {
      const session = loadFromStorage<{ token: string } | null>(STORAGE_KEYS.session, null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) throw new Error('API error');
      return response.json() as Promise<ApiResponse<T>>;
    }
  };
};

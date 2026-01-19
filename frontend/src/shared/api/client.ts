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
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) throw new Error('API error');
      return response.json() as Promise<ApiResponse<T>>;
    }
  };
};


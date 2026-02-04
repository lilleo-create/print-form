import type { Address } from '../types';
import { createFetchClient } from './client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const client = createFetchClient(baseUrl);

export const addressesApi = {
  listByUser: async (_userId: string, signal?: AbortSignal) => {
    const response = await client.request<Address[]>('/me/addresses', { signal });
    return response.data ?? [];
  },

  create: async (payload: Omit<Address, 'id' | 'createdAt'>, signal?: AbortSignal) => {
    const response = await client.request<Address>('/me/addresses', {
      method: 'POST',
      body: payload,
      signal
    });
    return response.data;
  },

  update: async (payload: Address, signal?: AbortSignal) => {
    const response = await client.request<Address>(`/me/addresses/${payload.id}`, {
      method: 'PATCH',
      body: payload,
      signal
    });
    return response.data;
  },

  remove: async (_userId: string, addressId: string, signal?: AbortSignal) => {
    await client.request<{ success: boolean }>(`/me/addresses/${addressId}`, {
      method: 'DELETE',
      signal
    });
  },

  setDefault: async (_userId: string, addressId: string, signal?: AbortSignal) => {
    await client.request<Address>(`/me/addresses/${addressId}/default`, {
      method: 'POST',
      signal
    });
  },

  getDefault: async (_userId: string, signal?: AbortSignal) => {
    const response = await client.request<Address | null>('/me/addresses/default', { signal });
    return response.data?.id ?? null;
  }
};

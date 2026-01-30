import { Address } from '../types';
import { createFetchClient } from './client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const client = createFetchClient(baseUrl);

export const addressesApi = {
  listByUser: async (_userId: string) => {
    const response = await client.request<Address[]>('/me/addresses');
    return response.data ?? [];
  },
  create: async (payload: Omit<Address, 'id' | 'createdAt'>) => {
    const response = await client.request<Address>('/me/addresses', { method: 'POST', body: payload });
    return response.data;
  },
  update: async (payload: Address) => {
    const response = await client.request<Address>(`/me/addresses/${payload.id}`, {
      method: 'PATCH',
      body: payload
    });
    return response.data;
  },
  remove: async (_userId: string, addressId: string) => {
    await client.request<{ success: boolean }>(`/me/addresses/${addressId}`, { method: 'DELETE' });
  },
  setDefault: async (_userId: string, addressId: string) => {
    await client.request<Address>(`/me/addresses/${addressId}/default`, { method: 'POST' });
  },
  getDefault: async (_userId: string) => {
    const response = await client.request<Address | null>('/me/addresses/default');
    return response.data?.id ?? null;
  }
};

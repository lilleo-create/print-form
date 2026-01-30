import { Contact } from '../types';
import { createFetchClient } from './client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const client = createFetchClient(baseUrl);

export const contactsApi = {
  listByUser: async (_userId: string) => {
    const response = await client.request<Contact[]>('/me/contacts');
    return response.data ?? [];
  },
  create: async (payload: Omit<Contact, 'id' | 'createdAt'>) => {
    const response = await client.request<Contact>('/me/contacts', { method: 'POST', body: payload });
    return response.data;
  },
  update: async (payload: Contact) => {
    const response = await client.request<Contact>(`/me/contacts/${payload.id}`, {
      method: 'PATCH',
      body: payload
    });
    return response.data;
  }
};

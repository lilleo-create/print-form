import { createFetchClient } from '../../../shared/api/client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const client = createFetchClient(baseUrl);

export type ProductCardDto = {
  id: string;
  title: string;
  price: number;
  image?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  shortSpec?: string | null;
};

export const favoritesApi = {
  async fetchFavorites(signal?: AbortSignal) {
    const response = await client.request<{ items: ProductCardDto[] }>('/favorites', { signal });
    return response.data.items ?? [];
  },

  async addFavorite(productId: string, signal?: AbortSignal) {
    await client.request<{ ok: true }>('/favorites', {
      method: 'POST',
      body: { productId },
      signal
    });
  },

  async removeFavorite(productId: string, signal?: AbortSignal) {
    await client.request<{ ok: true }>(`/favorites/${productId}`, {
      method: 'DELETE',
      signal
    });
  }
};

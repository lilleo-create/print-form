import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type FavoriteProduct = {
  id: string;
  title: string;
  price?: number;
  image?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  shortSpec?: string | null;
};

type FavoritesStore = {
  ids: string[];
  toggleFavorite: (id: string, product?: FavoriteProduct) => void;
  isFavorite: (id: string) => boolean;
  fetchFavorites: () => Promise<void>;
};

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      ids: [],

      toggleFavorite: (id: string) =>
        set((state) => {
          const has = state.ids.includes(id);
          return { ids: has ? state.ids.filter((i) => i !== id) : [...state.ids, id] };
        }),

      isFavorite: (id: string) => get().ids.includes(id),

      fetchFavorites: async () => {
        // Favorites are stored locally; no API call needed
      }
    }),
    { name: 'favorites' }
  )
);

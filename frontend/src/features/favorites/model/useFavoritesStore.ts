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
  category?: string | null;
};

type FavoritesStore = {
  ids: string[];
  items: FavoriteProduct[];
  toggleFavorite: (id: string, product?: FavoriteProduct) => void;
  isFavorite: (id: string) => boolean;
  fetchFavorites: () => Promise<void>;
};

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      ids: [],
      items: [],

      toggleFavorite: (id: string, product?: FavoriteProduct) =>
        set((state) => {
          const has = state.ids.includes(id);
          if (has) {
            return {
              ids: state.ids.filter((i) => i !== id),
              items: state.items.filter((item) => item.id !== id),
            };
          }
          return {
            ids: [...state.ids, id],
            items: [...state.items, product ?? { id, title: '' }],
          };
        }),

      isFavorite: (id: string) => get().ids.includes(id),

      fetchFavorites: async () => {
        // Favorites are stored locally; no API call needed
      },
    }),
    { name: 'favorites' }
  )
);

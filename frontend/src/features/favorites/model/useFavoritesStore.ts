import { create } from 'zustand';
import { favoritesApi, type ProductCardDto } from '../api/favoritesApi';

type FavoritesState = {
  items: ProductCardDto[];
  isLoading: boolean;
  error: string | null;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (productId: string, product?: ProductCardDto) => Promise<void>;
  isFavorite: (productId: string) => boolean;
};

let fetchController: AbortController | null = null;
const toggleControllers = new Map<string, AbortController>();

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchFavorites: async () => {
    fetchController?.abort();
    const controller = new AbortController();
    fetchController = controller;

    set({ isLoading: true, error: null });

    try {
      const items = await favoritesApi.fetchFavorites(controller.signal);
      if (controller.signal.aborted) return;
      set({ items, isLoading: false, error: null });
    } catch (error) {
      if (controller.signal.aborted) return;
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Не удалось загрузить избранное.'
      });
    }
  },

  toggleFavorite: async (productId, product) => {
    toggleControllers.get(productId)?.abort();
    const controller = new AbortController();
    toggleControllers.set(productId, controller);

    const prevItems = get().items;
    const exists = prevItems.some((item) => item.id === productId);

    const optimisticItems = exists
      ? prevItems.filter((item) => item.id !== productId)
      : [
          ...(product
            ? [
                {
                  id: product.id,
                  title: product.title,
                  price: product.price,
                  image: product.image,
                  ratingAvg: product.ratingAvg,
                  ratingCount: product.ratingCount,
                  shortSpec: product.shortSpec ?? null
                }
              ]
            : []),
          ...prevItems
        ];

    set({ items: optimisticItems, error: null });

    try {
      if (exists) {
        await favoritesApi.removeFavorite(productId, controller.signal);
      } else {
        await favoritesApi.addFavorite(productId, controller.signal);
      }

      if (controller.signal.aborted) {
        return;
      }

      if (!product && !exists) {
        await get().fetchFavorites();
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      set({
        items: prevItems,
        error: error instanceof Error ? error.message : 'Не удалось обновить избранное.'
      });
    }
  },

  isFavorite: (productId: string) => get().items.some((item) => item.id === productId)
}));

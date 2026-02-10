import { useCallback, useEffect, useState } from 'react';

const FAVORITES_KEY = 'favorites';

const readFavorites = () => {
  if (typeof window === 'undefined') return [] as string[];
  const raw = window.localStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((id) => typeof id === 'string') as string[]) : [];
  } catch {
    return [];
  }
};

const writeFavorites = (next: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
};

export const useFavorite = (productId?: string) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!productId) {
      setIsFavorite(false);
      return;
    }
    const favorites = readFavorites();
    setIsFavorite(favorites.includes(productId));
  }, [productId]);

  const toggleFavorite = useCallback(async () => {
    if (!productId || isLoading) {
      return { success: false, next: isFavorite };
    }
    setIsLoading(true);
    const nextValue = !isFavorite;
    setIsFavorite(nextValue);

    try {
      const favorites = readFavorites();
      const nextFavorites = nextValue
        ? Array.from(new Set([...favorites, productId]))
        : favorites.filter((id) => id !== productId);
      writeFavorites(nextFavorites);
      window.dispatchEvent(new Event('favorites:updated'));
      setIsLoading(false);
      return { success: true, next: nextValue };
    } catch {
      setIsFavorite(!nextValue);
      setIsLoading(false);
      return { success: false, next: !nextValue };
    }
  }, [isFavorite, isLoading, productId]);

  return { isFavorite, isLoading, toggleFavorite };
};

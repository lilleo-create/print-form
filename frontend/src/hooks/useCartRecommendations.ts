import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import type { Product } from '../shared/types';

const GRID_COUNT = 12; // 3 rows × 4 columns

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const useCartRecommendations = () => {
  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .getProducts({ limit: 100, sort: 'rating', order: 'desc' })
      .then((response) => {
        const raw = response.data as Product[] | { data?: Product[]; items?: Product[] };
        const list: Product[] = Array.isArray(raw)
          ? raw
          : (raw?.data ?? raw?.items ?? []);

        // Shuffle and take exactly GRID_COUNT unique items
        const unique = shuffle(list).slice(0, GRID_COUNT);
        setItems(unique);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return { items, isLoading };
};

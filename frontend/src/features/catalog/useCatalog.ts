import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';

export interface CatalogFilters {
  category?: string;
  material?: string;
  price?: string;
  size?: string;
  sort?: 'createdAt' | 'rating';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

let inFlightKey: string | null = null;
let inFlightController: AbortController | null = null;
let inFlightPromise: Promise<Product[]> | null = null;

export const useCatalog = (filters: CatalogFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        filters: {
          category: filters.category ?? '',
          material: filters.material ?? '',
          price: filters.price ?? '',
          size: filters.size ?? '',
          order: filters.order ?? ''
        },
        page: filters.page ?? '',
        sort: filters.sort ?? '',
        limit: filters.limit ?? ''
      }),
    [
      filters.category,
      filters.material,
      filters.price,
      filters.size,
      filters.order,
      filters.sort,
      filters.page,
      filters.limit
    ]
  );
  const requestFilters = useMemo(() => ({ ...filters }), [requestKey]);

  useEffect(() => {
    let isMounted = true;
    const currentKey = requestKey;
    if (inFlightKey !== currentKey || !inFlightPromise) {
      if (inFlightController) {
        inFlightController.abort();
      }
      inFlightController = new AbortController();
      inFlightKey = currentKey;
      inFlightPromise = api
        .getProducts({ ...requestFilters }, { signal: inFlightController.signal })
        .then((response) => response.data);
    }
    const activePromise = inFlightPromise;
    if (!activePromise) {
      return () => {
        isMounted = false;
      };
    }
    setLoading(true);
    activePromise
      .then((data) => {
        if (!isMounted) return;
        if (inFlightKey !== currentKey) return;
        setProducts(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (inFlightKey !== currentKey) return;
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if ((err as { status?: number })?.status === 429) {
          setError('Слишком много запросов. Пожалуйста, попробуйте позже.');
          return;
        }
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!isMounted) return;
        if (inFlightKey !== currentKey) return;
        inFlightPromise = null;
        inFlightController = null;
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [requestFilters, requestKey]);

  return { products, loading, error };
};

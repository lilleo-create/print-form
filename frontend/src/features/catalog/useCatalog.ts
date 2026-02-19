import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';

export interface CatalogFilters {
  category?: string;
  material?: string;
  price?: string;
  sort?: 'createdAt' | 'rating';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const useCatalog = (filters: CatalogFilters, enabled = true) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        category: filters.category ?? '',
        material: filters.material ?? '',
        price: filters.price ?? '',
        sort: filters.sort ?? '',
        order: filters.order ?? '',
        page: filters.page ?? '',
        limit: filters.limit ?? ''
      }),
    [
      filters.category,
      filters.material,
      filters.price,
      filters.sort,
      filters.order,
      filters.page,
      filters.limit
    ]
  );
  const requestFilters = useMemo(() => ({ ...filters }), [requestKey]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let isMounted = true;
    const sharedKey = requestKey;
    // Reuse in-flight request for identical params to avoid duplicate fetches in StrictMode/fast navigation.
    const entry = getCatalogRequest(sharedKey, requestFilters);
    entry.subscribers += 1;
    setLoading(true);
    entry.promise
      .then((data) => {
        if (!isMounted) return;
        setProducts(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        if ((err as { name?: string })?.name === 'AbortError') {
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
        setLoading(false);
      });
    return () => {
      isMounted = false;
      releaseCatalogRequest(sharedKey);
    };
  }, [enabled, requestFilters, requestKey]);

  return { products, loading, error };
};

type CatalogEntry = {
  controller: AbortController;
  promise: Promise<Product[]>;
  subscribers: number;
  abortTimeout?: ReturnType<typeof setTimeout>;
};

const catalogRequests = new Map<string, CatalogEntry>();

const getCatalogRequest = (key: string, filters: CatalogFilters) => {
  const existing = catalogRequests.get(key);
  if (existing) {
    if (existing.abortTimeout) {
      clearTimeout(existing.abortTimeout);
      existing.abortTimeout = undefined;
    }
    return existing;
  }
  const controller = new AbortController();
  const promise = api.getProducts({ ...filters }, { signal: controller.signal }).then((response) => response.data);
  const entry: CatalogEntry = { controller, promise, subscribers: 0 };
  catalogRequests.set(key, entry);
  promise.finally(() => {
    const current = catalogRequests.get(key);
    if (current === entry) {
      catalogRequests.delete(key);
    }
  });
  return entry;
};

const releaseCatalogRequest = (key: string) => {
  const entry = catalogRequests.get(key);
  if (!entry) return;
  entry.subscribers -= 1;
  if (entry.subscribers <= 0) {
    // Delay abort slightly so StrictMode remounts can reuse the same request without spam.
    entry.abortTimeout = setTimeout(() => {
      entry.controller.abort();
      catalogRequests.delete(key);
    }, 0);
  }
};

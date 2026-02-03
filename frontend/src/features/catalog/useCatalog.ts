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

export const useCatalog = (filters: CatalogFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        category: filters.category ?? '',
        material: filters.material ?? '',
        price: filters.price ?? '',
        size: filters.size ?? '',
        sort: filters.sort ?? '',
        order: filters.order ?? '',
        page: filters.page ?? '',
        limit: filters.limit ?? ''
      }),
    [
      filters.category,
      filters.material,
      filters.price,
      filters.size,
      filters.sort,
      filters.order,
      filters.page,
      filters.limit
    ]
  );
  const requestFilters = useMemo(() => ({ ...filters }), [requestKey]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    setLoading(true);
    api
      .getProducts({ ...requestFilters }, { signal: controller.signal })
      .then((response) => {
        if (!isMounted) return;
        setProducts(response.data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
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
        setLoading(false);
      });
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [requestFilters, requestKey]);

  return { products, loading, error };
};

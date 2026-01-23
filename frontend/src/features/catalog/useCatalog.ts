import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';

export interface CatalogFilters {
  category?: string;
  material?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  ratingMin?: number;
  color?: string;
  sort?: 'createdAt' | 'rating';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  cursor?: string;
}

export const useCatalog = (filters: CatalogFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api
      .getProducts(filters)
      .then((response) => {
        if (isMounted) {
          setProducts(response.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    filters.category,
    filters.material,
    filters.size,
    filters.minPrice,
    filters.maxPrice,
    filters.q,
    filters.ratingMin,
    filters.color,
    filters.sort,
    filters.order,
    filters.page,
    filters.limit,
    filters.cursor
  ]);

  return { products, loading, error };
};

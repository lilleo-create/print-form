import { useEffect, useMemo, useState } from 'react';
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
  const {
    category,
    material,
    size,
    minPrice,
    maxPrice,
    q,
    ratingMin,
    color,
    sort,
    order,
    page,
    limit,
    cursor
  } = filters;

  const normalizedFilters = useMemo(
    () => ({
      category,
      material,
      size,
      minPrice,
      maxPrice,
      q,
      ratingMin,
      color,
      sort,
      order,
      page,
      limit,
      cursor
    }),
    [category, material, size, minPrice, maxPrice, q, ratingMin, color, sort, order, page, limit, cursor]
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api
      .getProducts(normalizedFilters)
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
  }, [normalizedFilters]);

  return { products, loading, error };
};

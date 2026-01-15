import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';

export interface CatalogFilters {
  category?: string;
  material?: string;
  price?: string;
  size?: string;
}

export const useCatalog = (filters: CatalogFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getProducts(filters).then((response) => {
      if (active) {
        setProducts(response.data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [filters.category, filters.material, filters.price, filters.size]);

  return { products, loading };
};

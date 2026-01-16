import { useEffect, useMemo } from 'react';
import { useProductsStore } from '../../app/store/productsStore';

export interface CatalogFilters {
  category?: string;
  material?: string;
  price?: string;
  size?: string;
}

export const useCatalog = (filters: CatalogFilters) => {
  const { allProducts, loadProducts } = useProductsStore();

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const products = useMemo(() => {
    return allProducts.filter((item) => {
      const matchCategory = filters.category ? item.category === filters.category : true;
      const matchMaterial = filters.material ? item.material === filters.material : true;
      const matchSize = filters.size ? item.size === filters.size : true;
      const matchPrice = filters.price
        ? (() => {
            const [min, max] = filters.price.split('-').map(Number);
            return item.price >= min && item.price <= max;
          })()
        : true;
      return matchCategory && matchMaterial && matchSize && matchPrice;
    });
  }, [allProducts, filters.category, filters.material, filters.price, filters.size]);

  return { products, loading: allProducts.length === 0 };
};

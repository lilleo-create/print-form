import { useEffect, useMemo } from 'react';
import { useProductsStore } from '../../app/store/productsStore';

export const useFilters = () => {
  const { allProducts, loadProducts } = useProductsStore();

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filters = useMemo(() => {
    const categories = Array.from(new Set(allProducts.map((item) => item.category)));
    const materials = Array.from(new Set(allProducts.map((item) => item.material)));
    const sizes = Array.from(new Set(allProducts.map((item) => item.size)));
    return { categories, materials, sizes };
  }, [allProducts]);

  return filters;
};

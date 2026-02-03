import { ReactNode } from 'react';
import { useCatalog, CatalogFilters } from './useCatalog';
import { useFilters } from './useFilters';

type CatalogBootProps = {
  filters: CatalogFilters;
  enabled?: boolean;
  children: (data: {
    filterData: ReturnType<typeof useFilters>;
    products: ReturnType<typeof useCatalog>['products'];
    loading: ReturnType<typeof useCatalog>['loading'];
    error: ReturnType<typeof useCatalog>['error'];
  }) => ReactNode;
};

export const CatalogBoot = ({ filters, enabled = true, children }: CatalogBootProps) => {
  const filterData = useFilters(enabled);
  const { products, loading, error } = useCatalog(filters, enabled);

  return <>{children({ filterData, products, loading, error })}</>;
};

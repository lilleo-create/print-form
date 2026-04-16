import { ReactNode, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';
import { groupCatalogProducts } from '../../shared/lib/productGrouping';
import { CatalogFilters } from './useCatalog';
import { useFilters } from './useFilters';

type InfiniteCatalogBootProps = {
  filters: CatalogFilters;
  enabled?: boolean;
  children: (data: {
    filterData: ReturnType<typeof useFilters>;
    products: Product[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasNextPage: boolean;
    fetchNextPage: () => void;
  }) => ReactNode;
};

type CatalogResponseShape =
  | Product[]
  | {
      data?: Product[];
      items?: Product[];
      meta?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      };
    };

type CatalogPageResponse = {
  items: Product[];
  page: number;
  hasNextPage: boolean;
};

const normalizeCatalogResponse = (
  response: CatalogResponseShape,
  page: number,
  limit: number
): CatalogPageResponse => {
  const rawItems = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : [];

  const items = groupCatalogProducts(rawItems);
  const meta = Array.isArray(response) ? undefined : response?.meta;

  const totalPages = meta?.totalPages;
  const currentPage = meta?.page ?? page;
  const total = meta?.total;

  let hasNextPage = false;

  if (typeof totalPages === 'number') {
    hasNextPage = currentPage < totalPages;
  } else if (typeof total === 'number') {
    hasNextPage = currentPage * limit < total;
  } else {
    hasNextPage = rawItems.length >= limit;
  }

  return {
    items,
    page: currentPage,
    hasNextPage
  };
};

export const InfiniteCatalogBoot = ({
  filters,
  enabled = true,
  children
}: InfiniteCatalogBootProps) => {
  const filterData = useFilters(enabled);
  const limit = filters.limit ?? 18;

  const queryKey = useMemo(
    () => [
      'catalog',
      'infinite',
      filters.category ?? '',
      filters.material ?? '',
      filters.price ?? '',
      filters.sort ?? '',
      filters.order ?? '',
      limit
    ],
    [filters.category, filters.material, filters.price, filters.sort, filters.order, limit]
  );

  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const response = await api.getProducts(
        {
          ...filters,
          page: pageParam,
          limit
        },
        { signal }
      );

      return normalizeCatalogResponse(response.data as CatalogResponseShape, pageParam, limit);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasNextPage ? lastPage.page + 1 : undefined;
    }
  });

  const products = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      {children({
        filterData,
        products,
        loading: query.isLoading,
        loadingMore: query.isFetchingNextPage,
        error:
          query.error instanceof Error
            ? query.error.message
            : query.error
              ? 'Ошибка загрузки'
              : null,
        hasNextPage: Boolean(query.hasNextPage),
        fetchNextPage: () => {
          if (!query.isFetchingNextPage && query.hasNextPage) {
            void query.fetchNextPage();
          }
        }
      })}
    </>
  );
};
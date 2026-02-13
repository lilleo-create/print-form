import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/api';
import type { Product, Shop } from '../../../shared/types';

type SortKey = 'popular' | 'new' | 'cheap' | 'expensive';

const sortMap: Record<SortKey, { sort: 'createdAt' | 'rating' | 'price'; order: 'asc' | 'desc' }> = {
  popular: { sort: 'rating', order: 'desc' },
  new: { sort: 'createdAt', order: 'desc' },
  cheap: { sort: 'price', order: 'asc' },
  expensive: { sort: 'price', order: 'desc' }
};

const DEFAULT_LIMIT = 12;
const SEARCH_DEBOUNCE = 400;

const normalizeSort = (value: string | null): SortKey => {
  if (value === 'new' || value === 'cheap' || value === 'expensive' || value === 'popular') {
    return value;
  }
  return 'popular';
};

const parseFilters = (searchParams: URLSearchParams) => ({
  category: searchParams.get('category') ?? '',
  material: searchParams.get('material') ?? '',
  size: searchParams.get('size') ?? '',
  price: searchParams.get('price') ?? ''
});

export const useShopPage = (shopId?: string) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopReloadToken, setShopReloadToken] = useState(0);

  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filtersReloadToken, setFiltersReloadToken] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    categories: [] as string[],
    materials: [] as string[],
    sizes: [] as string[]
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [productsReloadToken, setProductsReloadToken] = useState(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const sortKey = normalizeSort(searchParams.get('sort'));
  const queryParam = searchParams.get('q') ?? '';

  const [searchValue, setSearchValue] = useState(queryParam);

  useEffect(() => {
    setSearchValue(queryParam);
  }, [queryParam]);

  useEffect(() => {
    if (toastMessage) {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    }
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, [toastMessage]);

  const updateParams = useCallback(
    (updates: Partial<Record<'category' | 'material' | 'size' | 'price' | 'sort' | 'q', string>>) => {
      const next = new URLSearchParams(searchParams);
      (Object.keys(updates) as Array<keyof typeof updates>).forEach((key) => {
        const value = updates[key];
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      });
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (queryParam === searchValue) return;
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (searchValue) {
        next.set('q', searchValue);
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE);
    return () => window.clearTimeout(handle);
  }, [queryParam, searchValue, searchParams, setSearchParams]);

  const handleFilterChange = useCallback(
    (key: 'category' | 'material' | 'size' | 'price', value: string) => {
      updateParams({ [key]: value });
    },
    [updateParams]
  );

  const handleSortChange = useCallback(
    (value: SortKey) => {
      updateParams({ sort: value });
    },
    [updateParams]
  );

  const resetFilters = useCallback(() => {
    updateParams({
      category: '',
      material: '',
      size: '',
      price: ''
    });
  }, [updateParams]);

  const applySearchNow = useCallback(() => {
    updateParams({ q: searchValue });
  }, [searchValue, updateParams]);

  const copyShopLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage('Ссылка скопирована');
    } catch {
      setToastMessage('Не удалось скопировать ссылку');
    }
  }, []);

  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    setShopLoading(true);
    api
      .getShop(shopId, { signal: controller.signal })
      .then((response) => {
        setShop(response.data);
        setShopError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setShopError(err instanceof Error ? err.message : 'Не удалось загрузить магазин');
      })
      .finally(() => setShopLoading(false));
    return () => controller.abort();
  }, [shopId, shopReloadToken]);

  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    setFiltersLoading(true);
    api
      .getShopFilters(shopId, { signal: controller.signal })
      .then((response) => {
        setFilterOptions(response.data);
        setFiltersError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setFiltersError(err instanceof Error ? err.message : 'Не удалось загрузить фильтры');
      })
      .finally(() => setFiltersLoading(false));
    return () => controller.abort();
  }, [shopId, filtersReloadToken]);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        shopId: shopId ?? '',
        ...filters,
        sort: sortKey,
        q: queryParam
      }),
    [filters, queryParam, shopId, sortKey]
  );

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
  }, [requestKey]);

  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    const { sort, order } = sortMap[sortKey];
    setProductsLoading(true);
    api
      .getProducts(
        {
          shopId,
          category: filters.category || undefined,
          material: filters.material || undefined,
          size: filters.size || undefined,
          price: filters.price || undefined,
          q: queryParam || undefined,
          sort,
          order,
          page,
          limit: DEFAULT_LIMIT
        },
        { signal: controller.signal }
      )
      .then((response) => {
        setProducts((prev) => (page === 1 ? response.data : [...prev, ...response.data]));
        setHasMore(response.data.length === DEFAULT_LIMIT);
        setProductsError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setProductsError(err instanceof Error ? err.message : 'Не удалось загрузить товары');
      })
      .finally(() => setProductsLoading(false));
    return () => controller.abort();
  }, [
    filters.category,
    filters.material,
    filters.price,
    filters.size,
    page,
    queryParam,
    shopId,
    sortKey,
    productsReloadToken
  ]);

  const loadMore = useCallback(() => {
    if (!hasMore || productsLoading) return;
    setPage((prev) => prev + 1);
  }, [hasMore, productsLoading]);

  const retryProducts = useCallback(() => {
    setProductsError(null);
    setPage(1);
    setHasMore(true);
    setProductsReloadToken((prev) => prev + 1);
  }, []);

  const retryShop = useCallback(() => {
    setShopError(null);
    setShopReloadToken((prev) => prev + 1);
  }, []);

  const retryFilters = useCallback(() => {
    setFiltersError(null);
    setFiltersReloadToken((prev) => prev + 1);
  }, []);

  return {
    shop,
    shopLoading,
    shopError,
    filters,
    filterOptions,
    filtersLoading,
    filtersError,
    products,
    productsLoading,
    productsError,
    hasMore,
    sortKey,
    searchQuery: queryParam,
    searchValue,
    toastMessage,
    setSearchValue,
    handleFilterChange,
    handleSortChange,
    resetFilters,
    applySearchNow,
    copyShopLink,
    loadMore,
    retryProducts,
    retryShop,
    retryFilters
  };
};

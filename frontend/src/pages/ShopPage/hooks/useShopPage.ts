import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/api';
import { normalizeApiError } from '../../../shared/api/client';
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
  const [isOwnerView, setIsOwnerView] = useState(false);

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
    (updates: Partial<Record<'category' | 'material' | 'price' | 'sort' | 'q', string>>) => {
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
    (key: 'category' | 'material' | 'price', value: string) => {
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

    const loadShop = async () => {
      try {
        let ownerView = false;
        try {
          const meResponse = await api.me();
          ownerView = meResponse.data.id === shopId;
        } catch {
          ownerView = false;
        }
        setIsOwnerView(ownerView);

        if (ownerView) {
          const contextResponse = await api.getSellerContext(controller.signal);
          const profile = contextResponse.data.profile;
          const canSell = Boolean(contextResponse.data.canSell);
          setShop({
            id: shopId,
            title: profile?.storeName?.trim() || 'Ваш магазин',
            avatarUrl: null,
            publicationStatusLabel: canSell
              ? 'Опубликован'
              : 'Черновик (публикация недоступна)',
            rating: null,
            reviewsCount: 0,
            subscribersCount: null,
            ordersCount: null,
            addressSlug: shopId,
            legalInfo: {
              name: profile?.storeName ?? undefined,
              status: profile?.status ?? undefined,
              phone: profile?.phone ?? undefined,
              city: profile?.city ?? undefined,
              referenceCategory: profile?.referenceCategory ?? undefined,
              catalogPosition: profile?.catalogPosition ?? undefined,
              inn: profile?.inn ?? undefined,
              ogrn: profile?.ogrn ?? undefined
            }
          });
          setShopError(null);
          return;
        }

        const response = await api.getShop(shopId, { signal: controller.signal });
        setShop(response.data);
        setShopError(null);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const normalizedError = normalizeApiError(err);
        if (normalizedError.code === 'STORE_NOT_PUBLIC') {
          setShopError('Магазин еще не опубликован для публичного просмотра.');
          return;
        }
        setShopError(normalizedError.message || 'Не удалось загрузить магазин');
      } finally {
        setShopLoading(false);
      }
    };

    void loadShop();
    return () => controller.abort();
  }, [shopId, shopReloadToken]);

  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    setFiltersLoading(true);

    const loadFilters = async () => {
      try {
        if (isOwnerView) {
          const response = await api.getSellerProducts();
          const ownProducts = response.data;
          const categories = Array.from(
            new Set(
              ownProducts
                .map((product) => product.category)
                .filter((category): category is string => Boolean(category))
            )
          ).sort();
          const materials = Array.from(
            new Set(
              ownProducts
                .map((product) => product.material)
                .filter(Boolean)
            )
          ).sort();
          setFilterOptions({ categories, materials });
          setFiltersError(null);
          return;
        }
        const response = await api.getShopFilters(shopId, { signal: controller.signal });
        setFilterOptions(response.data);
        setFiltersError(null);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const normalizedError = normalizeApiError(err);
        setFiltersError(normalizedError.message || 'Не удалось загрузить фильтры');
      } finally {
        setFiltersLoading(false);
      }
    };

    void loadFilters();
    return () => controller.abort();
  }, [shopId, filtersReloadToken, isOwnerView]);

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
    setProductsLoading(true);
    const { sort, order } = sortMap[sortKey];

    const loadProducts = async () => {
      try {
        if (isOwnerView) {
          const response = await api.getSellerProducts();
          let filteredProducts = response.data;
          if (filters.category) {
            filteredProducts = filteredProducts.filter((item) => item.category === filters.category);
          }
          if (filters.material) {
            filteredProducts = filteredProducts.filter((item) => item.material === filters.material);
          }
          if (filters.price) {
            const [minRaw, maxRaw] = filters.price.split('-');
            const min = Number(minRaw);
            const max = Number(maxRaw);
            if (!Number.isNaN(min)) {
              filteredProducts = filteredProducts.filter((item) => item.price >= min);
            }
            if (!Number.isNaN(max)) {
              filteredProducts = filteredProducts.filter((item) => item.price <= max);
            }
          }
          if (queryParam) {
            const query = queryParam.toLowerCase();
            filteredProducts = filteredProducts.filter((item) =>
              item.title.toLowerCase().includes(query)
            );
          }
          filteredProducts = [...filteredProducts].sort((left, right) => {
            if (sort === 'price') {
              return order === 'asc' ? left.price - right.price : right.price - left.price;
            }
            if (sort === 'rating') {
              const leftValue = left.ratingAvg ?? 0;
              const rightValue = right.ratingAvg ?? 0;
              return order === 'asc' ? leftValue - rightValue : rightValue - leftValue;
            }
            const leftTime = new Date(left.createdAt ?? 0).getTime();
            const rightTime = new Date(right.createdAt ?? 0).getTime();
            return order === 'asc' ? leftTime - rightTime : rightTime - leftTime;
          });
          const offset = (page - 1) * DEFAULT_LIMIT;
          const pagedProducts = filteredProducts.slice(offset, offset + DEFAULT_LIMIT);
          setProducts((prev) => (page === 1 ? pagedProducts : [...prev, ...pagedProducts]));
          setHasMore(offset + DEFAULT_LIMIT < filteredProducts.length);
          setProductsError(null);
          return;
        }

        const response = await api.getProducts(
          {
            shopId,
            category: filters.category || undefined,
            material: filters.material || undefined,
            price: filters.price || undefined,
            q: queryParam || undefined,
            sort,
            order,
            page,
            limit: DEFAULT_LIMIT
          },
          { signal: controller.signal }
        );
        setProducts((prev) => (page === 1 ? response.data : [...prev, ...response.data]));
        setHasMore(response.data.length === DEFAULT_LIMIT);
        setProductsError(null);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const normalizedError = normalizeApiError(err);
        setProductsError(normalizedError.message || 'Не удалось загрузить товары');
      } finally {
        setProductsLoading(false);
      }
    };

    void loadProducts();
    return () => controller.abort();
  }, [
    filters.category,
    filters.material,
    filters.price,
    page,
    queryParam,
    shopId,
    sortKey,
    productsReloadToken,
    isOwnerView
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

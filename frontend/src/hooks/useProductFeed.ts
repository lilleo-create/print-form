import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { api } from '../shared/api';
import type { Product } from '../shared/types';
import type { LoadStatus } from './useProduct';

export type UseProductFeedOptions = {
  productId: string;
  limit?: number;
  sort?: 'createdAt' | 'rating';
  order?: 'asc' | 'desc';
  rootMargin?: string;
};

type UseProductFeedResult = {
  items: Product[];
  status: LoadStatus;
  error: string | null;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement>;
  loadMore: () => void;
};

const extractData = <T,>(value: unknown): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
};

export const useProductFeed = ({
  productId,
  limit = 6,
  sort = 'createdAt',
  order = 'desc',
  rootMargin = '200px'
}: UseProductFeedOptions): UseProductFeedResult => {
  const [items, setItems] = useState<Product[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const stopRef = useRef(false);
  const lastLoadAtRef = useRef(0);

  const resetFeed = useCallback(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
    setStatus('idle');
    stopRef.current = false;
  }, []);

  const loadMore = useCallback(() => {
    if (loadingRef.current || stopRef.current || !hasMore) return;

    const now = Date.now();
    if (now - lastLoadAtRef.current < 300) return;
    lastLoadAtRef.current = now;

    loadingRef.current = true;
    setStatus('loading');

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const requestId = ++requestIdRef.current;

    api
      .getProducts(
        {
          cursor: cursor ?? undefined,
          limit,
          sort,
          order
        },
        { signal: controller.signal }
      )
      .then((response) => {
        if (requestIdRef.current !== requestId) return;

        const raw = extractData<unknown>(response);
        const nextItems = Array.isArray(raw)
          ? (raw as Product[])
          : ((raw as { data?: Product[] })?.data ?? []);

        setItems((prev) => {
          const existing = new Set(prev.map((item) => item.id));
          const filtered = nextItems.filter((item) => item.id !== productId && !existing.has(item.id));
          return [...prev, ...filtered];
        });

        setHasMore(nextItems.length > 0);
        if (nextItems.length === 0) {
          stopRef.current = true;
        }
        setCursor(nextItems.length ? nextItems[nextItems.length - 1]?.id ?? null : null);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if ((err as { name?: string })?.name === 'AbortError') return;

        const statusCode = (err as { status?: number })?.status;
        if (statusCode === 429) {
          stopRef.current = true;
          setHasMore(false);
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить товары.');
        setStatus('error');
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        loadingRef.current = false;
      });
  }, [cursor, hasMore, limit, order, productId, sort]);

  useEffect(() => {
    resetFeed();
  }, [productId, resetFeed]);

  useEffect(() => {
    if (status !== 'idle') return;
    if (!hasMore || stopRef.current) return;
    loadMore();
  }, [hasMore, loadMore, status]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (!hasMore || stopRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        loadMore();
      },
      { rootMargin }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, rootMargin]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return useMemo(
    () => ({
      items,
      status,
      error,
      hasMore,
      sentinelRef,
      loadMore
    }),
    [items, status, error, hasMore, loadMore]
  );
};

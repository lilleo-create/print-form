import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../shared/api';
import type { Review } from '../shared/types';
import type { LoadStatus } from './useProduct';

export type ReviewSummary = {
  total: number;
  avg: number;
  counts: { rating: number; count: number }[];
  photos?: string[];
};

type UseProductReviewsOptions = {
  page?: number;
  limit?: number;
  sort?: 'helpful' | 'high' | 'low' | 'new';
  keepPreviousData?: boolean;
};

type UseProductReviewsResult = {
  reviews: Review[];
  summary: ReviewSummary | null;
  status: LoadStatus;
  error: string | null;
  refresh: () => void;
};

const extractData = <T,>(value: unknown): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
};

export const useProductReviews = (
  productId: string,
  options: UseProductReviewsOptions = {}
): UseProductReviewsResult => {
  const { page = 1, limit = 3, sort = 'new', keepPreviousData = true } = options;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!productId) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const requestId = ++requestIdRef.current;

    setStatus('loading');
    setError(null);
    if (!keepPreviousData) {
      setReviews([]);
      setSummary(null);
    }

    const reviewsPromise = api
      .getProductReviews(productId, page, limit, sort, undefined, { signal: controller.signal })
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        const raw = extractData<{ data?: Review[] } | Review[]>(response);
        const resolved = Array.isArray(raw) ? raw : raw?.data ?? [];
        setReviews(resolved);
      });

    const summaryPromise = api
      .getReviewSummary(productId, undefined, { signal: controller.signal })
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        const raw = extractData<{ data?: ReviewSummary } | ReviewSummary>(response);
        setSummary((raw as { data?: ReviewSummary })?.data ?? raw ?? null);
      });

    Promise.all([reviewsPromise, summaryPromise])
      .then(() => {
        if (requestIdRef.current !== requestId) return;
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (!keepPreviousData) {
          setReviews([]);
          setSummary(null);
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить отзывы.');
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [productId, page, limit, sort, refreshIndex, keepPreviousData]);

  return { reviews, summary, status, error, refresh };
};

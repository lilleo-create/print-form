import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Review } from '../../../shared/types';
import { api } from '../../../shared/api';

export type ReviewFilters = {
  helpful: boolean;
  withMedia: boolean;
  high: boolean;
  low: boolean;
  new: boolean;
};

export type ReviewScope = 'all' | 'variant';

type ReviewSummary = {
  total: number;
  avg: number;
  counts: { rating: number; count: number }[];
  photos?: string[];
};

type Status = 'idle' | 'loading' | 'success' | 'error';

type Options = {
  filters: ReviewFilters;
  scope: ReviewScope;
  productIds: string[];
  pageSize?: number;
};

const applyFilters = (reviews: Review[], filters: ReviewFilters) => {
  let next = [...reviews];
  next = next.filter((review) => {
    const status = review.moderationStatus ?? (review as { status?: string }).status;
    return status ? status === 'APPROVED' : true;
  });
  if (filters.withMedia) {
    next = next.filter((review) => (review.photos?.length ?? 0) > 0);
  }
  if (filters.high && !filters.low) {
    next = next.filter((review) => review.rating >= 4);
  }
  if (filters.low && !filters.high) {
    next = next.filter((review) => review.rating <= 3);
  }
  return next;
};

const getSort = (filters: ReviewFilters) => {
  if (filters.helpful) return 'helpful';
  if (filters.high) return 'high';
  if (filters.low) return 'low';
  return 'new';
};

export const useProductReviews = (productId: string | undefined, options: Options) => {
  const { filters, scope, productIds, pageSize = 6 } = options;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestRef = useRef(0);

  const reviewProductIds = scope === 'all' ? productIds : undefined;
  const sort = getSort(filters);

  const fetchSummary = useCallback(async () => {
    if (!productId) return;
    try {
      const response = await api.getReviewSummary(productId, reviewProductIds);
      setSummary(response.data.data ?? null);
    } catch {
      setSummary(null);
    }
  }, [productId, reviewProductIds]);

  const fetchReviews = useCallback(
    async (nextPage: number, reset = false) => {
      if (!productId) return;
      setStatus('loading');
      setError(null);
      const requestId = ++requestRef.current;
      try {
        const response = await api.getProductReviews(
          productId,
          nextPage,
          pageSize,
          sort as 'helpful' | 'high' | 'low' | 'new',
          reviewProductIds
        );
        if (requestId !== requestRef.current) return;
        const list = response.data.data ?? [];
        setReviews((prev) => (reset ? list : [...prev, ...list]));
        setHasMore(list.length === pageSize);
        setStatus('success');
      } catch {
        if (requestId !== requestRef.current) return;
        setStatus('error');
        setError('Не удалось загрузить отзывы.');
        if (reset) {
          setReviews([]);
        }
        setHasMore(false);
      }
    },
    [pageSize, productId, reviewProductIds, sort]
  );

  const refresh = useCallback(async () => {
    setPage(1);
    await Promise.all([fetchSummary(), fetchReviews(1, true)]);
  }, [fetchReviews, fetchSummary]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(nextPage, false);
  }, [fetchReviews, page]);

  useEffect(() => {
    if (!productId) return;
    refresh();
  }, [productId, scope, sort, reviewProductIds, refresh]);

  const filteredReviews = useMemo(() => applyFilters(reviews, filters), [reviews, filters]);

  return {
    reviews: filteredReviews,
    summary,
    status,
    error,
    hasMore,
    loadMore,
    refresh
  };
};

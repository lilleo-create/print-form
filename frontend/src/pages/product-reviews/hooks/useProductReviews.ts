import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Review, ReviewReply } from '../../../shared/types';
import { api } from '../../../shared/api';
import { normalizeReviewPhotoUrl, type ReviewPhotoLike } from '../../../shared/lib/reviews';

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

// Нормализация ответов: поддерживаем {data: ...} и {data: {data: ...}}
function unwrap<T>(res: any): T | null {
  const d = res?.data;
  if (d == null) return null;
  if (typeof d === 'object' && 'data' in d) return (d as any).data as T;
  return d as T;
}

const applyFilters = (reviews: Review[], filters: ReviewFilters) => {
  let next = [...reviews];

  next = next.filter((review) => !(review.moderationStatus === 'PENDING' && review.isOwn === false));

  if (filters.withMedia) {
    next = next.filter((review) => (review.photos?.length ?? 0) > 0);
  }

  if (filters.high && !filters.low) {
    next = next.filter((review) => review.rating >= 4);
  }

  if (filters.low && !filters.high) {
    next = next.filter((review) => review.rating <= 3);
  }

  return next.sort((a, b) => {
    const ownA = a.isOwn === true ? 1 : 0;
    const ownB = b.isOwn === true ? 1 : 0;
    if (ownA !== ownB) {
      return ownB - ownA;
    }
    return 0;
  });
};

const getSort = (filters: ReviewFilters) => {
  if (filters.helpful) return 'helpful';
  if (filters.high) return 'high';
  if (filters.low) return 'low';
  return 'new';
};

const normalizeReview = (review: Review): Review => ({
  ...review,
  photos: (((review as Review & { photos?: ReviewPhotoLike[] }).photos ?? []) as ReviewPhotoLike[])
    .map((photo) => normalizeReviewPhotoUrl(photo))
    .filter(Boolean),
  replies: review.replies?.map((reply) => ({
    ...reply,
    text: reply.text || (reply as ReviewReply & { message?: string }).message || ''
  }))
});

type UpsertReviewOptions = {
  prepend?: boolean;
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
      const payload = unwrap<ReviewSummary>(response);
      setSummary(payload ?? null);
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

        const payload = unwrap<Review[]>(response);
        const list = Array.isArray(payload) ? payload.map((review) => normalizeReview(review)) : [];

        setReviews((prev) => (reset ? list : [...prev, ...list]));
        setHasMore(list.length === pageSize);
        setStatus('success');
      } catch {
        if (requestId !== requestRef.current) return;

        setStatus('error');
        setError('Не удалось загрузить отзывы.');

        if (reset) setReviews([]);
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

  const upsertReview = useCallback((review: Review, options?: UpsertReviewOptions) => {
    const normalized = normalizeReview(review);
    setReviews((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== normalized.id);
      return options?.prepend ? [normalized, ...withoutCurrent] : [...withoutCurrent, normalized];
    });
  }, []);

  return {
    reviews: filteredReviews,
    summary,
    status,
    error,
    hasMore,
    loadMore,
    refresh,
    upsertReview
  };
};

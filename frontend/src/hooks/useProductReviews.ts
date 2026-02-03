// frontend/src/hooks/useProductReviews.ts
import { useEffect, useRef, useState } from 'react';
import type { Review } from '../shared/types';
import { api } from '../shared/api';
import { ApiError } from '../shared/api/client';

type Status = 'idle' | 'loading' | 'success' | 'error';

type ReviewSummary = {
  total: number;
  avg: number;
  counts: { rating: number; count: number }[];
  photos?: string[];
};

type Options = {
  keepPreviousData?: boolean;
  ttlMs?: number;
};

const reviewsCache = new Map<
  string,
  { ts: number; reviews: Review[]; summary: ReviewSummary | null }
>();

export function useProductReviews(productId: string, opts?: Options) {
  const ttlMs = opts?.ttlMs ?? 30_000;

  const cached = reviewsCache.get(productId);
  const [reviews, setReviews] = useState<Review[]>(cached?.reviews ?? []);
  const [summary, setSummary] = useState<ReviewSummary | null>(cached?.summary ?? null);
  const [status, setStatus] = useState<Status>(cached ? 'success' : 'loading');

  const reqIdRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  useEffect(() => {
    const cached = reviewsCache.get(productId);
    const fresh = cached && Date.now() - cached.ts < ttlMs;

    if (fresh) {
      setReviews(cached!.reviews);
      setSummary(cached!.summary);
      setStatus('success');
      return;
    }

    if (!opts?.keepPreviousData) {
      setReviews([]);
      setSummary(null);
    }

    if (Date.now() < cooldownUntilRef.current) return;

    const controller = new AbortController();
    const reqId = ++reqIdRef.current;
    setStatus('loading');

    Promise.all([
      api.getProductReviews(productId, 1, 3, 'new', undefined, { signal: controller.signal }),
      api.getReviewSummary(productId, undefined, { signal: controller.signal })
    ])
      .then(([r1, r2]: any[]) => {
        if (reqId !== reqIdRef.current) return;

        const reviews = Array.isArray(r1?.data) ? r1.data : (r1?.data?.data ?? r1?.data ?? r1 ?? []);
        const summary = (r2?.data?.data ?? r2?.data ?? r2 ?? null) as ReviewSummary | null;

        setReviews(reviews);
        setSummary(summary);
        reviewsCache.set(productId, { ts: Date.now(), reviews, summary });
        setStatus('success');
      })
      .catch((e: any) => {
        if (reqId !== reqIdRef.current) return;
        if (e?.name === 'AbortError') return;

        const statusCode = e?.status ?? (e instanceof ApiError ? e.status : undefined);
        if (statusCode === 429) {
          cooldownUntilRef.current = Date.now() + 3000;
          // не обнуляем, просто оставляем предыдущие данные
          setStatus('success');
          return;
        }

        setStatus('error');
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, ttlMs]);

  return { reviews, summary, status };
}

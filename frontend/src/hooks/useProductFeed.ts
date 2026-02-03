// frontend/src/hooks/useProductFeed.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Product } from '../shared/types';
import { api } from '../shared/api';
import { ApiError } from '../shared/api/client';

type Status = 'idle' | 'loading' | 'success' | 'error';

type Args = { productId: string };

const feedCache = new Map<string, { ts: number; items: Product[] }>();
const TTL = 30_000;

export function useProductFeed({ productId }: Args) {
  const [items, setItems] = useState<Product[]>(() => feedCache.get(productId)?.items ?? []);
  const [status, setStatus] = useState<Status>(items.length ? 'success' : 'idle');

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  // reset when product changes
  useEffect(() => {
    controllerRef.current?.abort();
    cursorRef.current = null;
    hasMoreRef.current = true;
    loadingRef.current = false;

    const cached = feedCache.get(productId);
    if (cached && Date.now() - cached.ts < TTL) {
      setItems(cached.items);
      setStatus('success');
    } else {
      setItems([]);
      setStatus('idle');
    }
  }, [productId]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    if (!hasMoreRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;

    loadingRef.current = true;
    setStatus('loading');

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res: any = await api.getProducts(
        {
          cursor: cursorRef.current ?? undefined,
          limit: 6,
          sort: 'createdAt',
          order: 'desc'
        },
        { signal: controller.signal }
      );

      const raw = res?.data ?? res;
      const fetched: Product[] = Array.isArray(raw) ? raw : (raw?.data ?? []);

      const next = fetched.filter((p) => p.id !== productId);

      setItems((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        const merged = [...prev, ...next.filter((x) => !ids.has(x.id))];
        feedCache.set(productId, { ts: Date.now(), items: merged });
        return merged;
      });

      hasMoreRef.current = fetched.length > 0;
      cursorRef.current = fetched.length ? fetched[fetched.length - 1]?.id ?? null : null;

      setStatus('success');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;

      const statusCode = e?.status ?? (e instanceof ApiError ? e.status : undefined);
      if (statusCode === 429) {
        cooldownUntilRef.current = Date.now() + 5000;
        hasMoreRef.current = false;
        setStatus('success');
        return;
      }

      hasMoreRef.current = false;
      setStatus('error');
    } finally {
      loadingRef.current = false;
    }
  }, [productId]);

  // observer: грузим только когда пользователь реально долистал
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        loadMore();
      },
      { rootMargin: '400px' }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { items, status, sentinelRef };
}

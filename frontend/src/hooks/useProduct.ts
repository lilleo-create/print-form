// frontend/src/hooks/useProduct.ts
import { useEffect, useRef, useState } from 'react';
import type { Product } from '../shared/types';
import { api } from '../shared/api';
import { ApiError } from '../shared/api/client'; // путь подстрой

type Status = 'idle' | 'loading' | 'success' | 'error';

type Options = {
  keepPreviousData?: boolean;
  ttlMs?: number;
};

const productCache = new Map<string, { ts: number; data: Product | null }>();

export function useProduct(productId: string, opts?: Options) {
  const ttlMs = opts?.ttlMs ?? 30_000;

  const [data, setData] = useState<Product | null>(() => {
    const cached = productCache.get(productId);
    return cached ? cached.data : null;
  });
  const [status, setStatus] = useState<Status>(data ? 'success' : 'loading');
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  useEffect(() => {
    const cached = productCache.get(productId);
    const fresh = cached && Date.now() - cached.ts < ttlMs;

    if (fresh) {
      setData(cached!.data);
      setStatus(cached!.data ? 'success' : 'error');
      setError(cached!.data ? null : 'Товар не найден.');
      return;
    }

    if (!opts?.keepPreviousData) setData(null);

    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    if (Date.now() < cooldownUntilRef.current) return;

    setStatus('loading');
    setError(null);

    api
      .getProduct(productId, { signal: controller.signal })
      .then((res: any) => {
        if (reqId !== reqIdRef.current) return;
        const product = res?.data ?? res ?? null;
        setData(product);
        productCache.set(productId, { ts: Date.now(), data: product });
        setStatus(product ? 'success' : 'error');
        if (!product) setError('Товар не найден.');
      })
      .catch((e: any) => {
        if (reqId !== reqIdRef.current) return;
        if (e?.name === 'AbortError') return;

        const statusCode = e?.status ?? (e instanceof ApiError ? e.status : undefined);
        if (statusCode === 429) {
          cooldownUntilRef.current = Date.now() + 3000;
          setError('Слишком много запросов. Подождите пару секунд.');
          setStatus(data ? 'success' : 'error');
          return;
        }

        setError(e instanceof Error ? e.message : 'Не удалось загрузить товар.');
        setStatus('error');
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, ttlMs]);

  return { data, status, error };
}

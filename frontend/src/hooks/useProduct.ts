import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../shared/api';
import type { Product } from '../shared/types';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

type UseProductOptions = {
  keepPreviousData?: boolean;
};

type UseProductResult = {
  data: Product | null;
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

export const useProduct = (productId: string, options: UseProductOptions = {}): UseProductResult => {
  const { keepPreviousData = true } = options;
  const [data, setData] = useState<Product | null>(null);
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
      setData(null);
    }

    api
      .getProduct(productId, { signal: controller.signal })
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        const productData = extractData<Product | null>(response);
        setData(productData ?? null);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if ((err as { name?: string })?.name === 'AbortError') return;
        if ((err as { status?: number })?.status === 404) {
          setData(null);
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить товар.');
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [productId, refreshIndex, keepPreviousData]);

  return { data, status, error, refresh };
};

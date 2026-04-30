import { useRef, useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { api } from '../shared/api';
import type { Product } from '../shared/types';

type UseProductFeedOptions = {
  productId: string;
};

type FeedStatus = 'idle' | 'loading' | 'loaded' | 'error';

export const useProductFeed = ({ productId }: UseProductFeedOptions) => {
  const [items, setItems] = useState<Product[]>([]);
  const [status, setStatus] = useState<FeedStatus>('idle');
  const loadedRef = useRef(false);

  const { ref: sentinelRef, inView } = useInView({ threshold: 0, rootMargin: '400px' });

  useEffect(() => {
    if (!inView || loadedRef.current) return;
    loadedRef.current = true;
    setStatus('loading');

    api
      .getProducts({ limit: 8, sort: 'createdAt', order: 'desc' })
      .then((response) => {
        const data = response.data as Product[] | { data?: Product[]; items?: Product[] };
        const list = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
        setItems(list.filter((p) => p.id !== productId).slice(0, 8));
        setStatus('loaded');
      })
      .catch(() => setStatus('error'));
  }, [inView, productId]);

  return { items, status, sentinelRef };
};

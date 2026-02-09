import { useEffect, useState } from 'react';
import { api } from '../../../shared/api';
import type { Shop } from '../../../shared/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

export const useProductShopBadge = (shopId?: string | null) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) {
      setShop(null);
      setStatus('idle');
      setError(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    api
      .getShop(shopId, { signal: controller.signal })
      .then((response) => {
        if (!isMounted) return;
        setShop(response.data);
        setStatus('success');
      })
      .catch((err) => {
        if (!isMounted) return;
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить магазин');
        setStatus('error');
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [shopId]);

  return {
    shop,
    loading: status === 'loading',
    error,
    disabled: !shopId
  };
};

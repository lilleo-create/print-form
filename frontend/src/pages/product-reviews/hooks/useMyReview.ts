import { useCallback, useEffect, useState } from 'react';
import type { Review } from '../../../shared/types';
import { api } from '../../../shared/api';
import { useAuthStore } from '../../../app/store/authStore';

type Options = {
  productIds: string[];
  enabled?: boolean;
};

type Status = 'idle' | 'loading' | 'success' | 'error';

export const useMyReview = ({ productIds, enabled = true }: Options) => {
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<Status>('idle');
  const [hasPurchased, setHasPurchased] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);

  const refresh = useCallback(async () => {
    if (!user || productIds.length === 0 || !enabled) {
      setHasPurchased(false);
      setMyReview(null);
      return;
    }
    setStatus('loading');
    try {
      const [ordersResponse, reviewsResponse] = await Promise.all([api.getOrders(), api.getMyReviews()]);
      const orders = ordersResponse.data ?? [];
      const reviews = reviewsResponse.data.data ?? [];
      const purchased = orders.some((order) =>
        order.items?.some((item) => productIds.includes(item.productId))
      );
      const review = reviews.find((item) => {
        const reviewProductId = item.productId ?? item.product?.id;
        return reviewProductId ? productIds.includes(reviewProductId) : false;
      });
      setHasPurchased(purchased);
      setMyReview(review ?? null);
      setStatus('success');
    } catch {
      setHasPurchased(false);
      setMyReview(null);
      setStatus('error');
    }
  }, [enabled, productIds, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { hasPurchased, myReview, status, refresh };
};

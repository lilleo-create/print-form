import { useState } from 'react';
import type { Review } from '../../../shared/types';

type UseMyReviewOptions = {
  productId?: string;
  productIds?: string[];
  enabled?: boolean;
};

export const useMyReview = (_options: UseMyReviewOptions) => {
  const [myReview] = useState<Review | null>(null);

  return {
    myReview,
    isLoading: false,
    canReview: false,
    hasPurchased: false,
    refresh: async () => {}
  };
};

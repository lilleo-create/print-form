import type { Product } from '../types';

export const getProductRatingMeta = (product: Pick<Product, 'ratingAvg' | 'ratingCount'>) => {
  const ratingCount = Number(product.ratingCount ?? 0);
  const ratingAvg = typeof product.ratingAvg === 'number' && Number.isFinite(product.ratingAvg)
    ? product.ratingAvg
    : 0;

  const hasReviews = ratingCount > 0;
  const hasValidRating = hasReviews && ratingAvg > 0;

  return {
    hasReviews,
    hasValidRating,
    ratingCount,
    ratingValue: hasValidRating ? ratingAvg : 0
  };
};

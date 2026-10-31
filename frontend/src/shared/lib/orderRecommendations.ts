import type { Order, Product } from '../types';

export const rankOrderRecommendations = (order: Order, products: Product[], limit = 6, boughtCategories: string[] = []): Product[] => {
  const bought = new Set(order.items.map(item => item.productId));
  const sellerIds = new Set(order.items.map(item => item.sellerId));
  const categorySet = new Set(boughtCategories);
  return products.filter(product => product.moderationStatus === undefined || product.moderationStatus === 'APPROVED')
    .filter(product => !bought.has(product.id) && !product.parentProductId)
    .sort((a, b) => {
      const score = (product: Product) => (categorySet.has(product.category) ? 4 : 0) + (sellerIds.has(product.sellerId ?? '') ? 2 : 0);
      return score(b) - score(a) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    }).slice(0, limit);
};

import { describe, expect, it } from 'vitest';
import type { Order, Product } from '../types';
import { rankOrderRecommendations } from './orderRecommendations';

const order = { items: [{ productId: 'bought', sellerId: 'seller' }] } as Order;
const product = (id: string, category: string, sellerId = 'other'): Product => ({ id, category, sellerId, moderationStatus: 'APPROVED' } as Product);

describe('post-purchase recommendations', () => {
  it('ranks category then seller, excludes purchased and non-approved', () => {
    const result = rankOrderRecommendations(order, [product('other', 'Other'), product('seller', 'Other', 'seller'), product('category', 'Decor'), product('bought', 'Decor'), { ...product('draft', 'Decor'), moderationStatus: 'DRAFT' }], 6, ['Decor']);
    expect(result.map(item => item.id)).toEqual(['category', 'seller', 'other']);
  });
});

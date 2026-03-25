import { apiClient } from './api';
import type { ProductVariant } from '../types';

export type SellerProductVariantInput = {
  name: string;
  options?: Record<string, string[]>;
  priceDelta?: number;
  sku?: string;
  stock?: number;
};

export const sellerProductVariantsService = {
  list(productId: string) {
    return apiClient.request<ProductVariant[]>(`/seller/products/${productId}/variants`);
  },

  create(productId: string, payload: SellerProductVariantInput) {
    return apiClient.request<ProductVariant>(`/seller/products/${productId}/variants`, {
      method: 'POST',
      body: payload,
    });
  },

  update(productId: string, variantId: string, payload: Partial<SellerProductVariantInput>) {
    return apiClient.request<ProductVariant>(`/seller/products/${productId}/variants/${variantId}`, {
      method: 'PUT',
      body: payload,
    });
  },

  remove(productId: string, variantId: string) {
    return apiClient.request<{ success: boolean }>(`/seller/products/${productId}/variants/${variantId}`, {
      method: 'DELETE',
    });
  },
};

import { apiClient } from './api';
import type { ProductVariant } from '../types';

export type SellerProductVariantInput = {
  name: string;
  options?: Record<string, string[]>;
  priceDelta?: number;
  stock?: number;
};

export const sanitizeVariantPayload = <T extends Partial<SellerProductVariantInput>>(
  payload: T
) => {
  const { options, ...rest } = payload;
  const normalizedOptions =
    options && Object.keys(options).length > 0 ? options : undefined;
  const compactRest = Object.fromEntries(
    Object.entries(rest).filter(([key, value]) => key !== 'sku' && value !== undefined)
  ) as Omit<T, 'options'>;

  return {
    ...compactRest,
    ...(normalizedOptions ? { options: normalizedOptions } : {}),
  } as Omit<T, 'options'> & { options?: Record<string, string[]> };
};

export const sellerProductVariantsService = {
  list(productId: string) {
    return apiClient.request<ProductVariant[]>(`/seller/products/${productId}/variants`);
  },

  create(productId: string, payload: SellerProductVariantInput) {
    return apiClient.request<ProductVariant>(`/seller/products/${productId}/variants`, {
      method: 'POST',
      body: sanitizeVariantPayload(payload),
    });
  },

  update(productId: string, variantId: string, payload: Partial<SellerProductVariantInput>) {
    return apiClient.request<ProductVariant>(`/seller/products/${productId}/variants/${variantId}`, {
      method: 'PUT',
      body: sanitizeVariantPayload(payload),
    });
  },

  remove(productId: string, variantId: string) {
    return apiClient.request<{ success: boolean }>(`/seller/products/${productId}/variants/${variantId}`, {
      method: 'DELETE',
    });
  },
};

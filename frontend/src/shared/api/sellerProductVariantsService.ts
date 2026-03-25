import { apiClient } from './api';
import type { ProductVariant } from '../types';

export type SellerProductVariantInput = {
  name: string;
  options?: Record<string, string[]>;
  priceDelta?: number;
  sku?: string;
  stock?: number;
};

const normalizeSku = (sku: unknown) => {
  if (typeof sku !== 'string') return undefined;
  const trimmed = sku.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const sanitizeVariantPayload = <T extends Partial<SellerProductVariantInput>>(
  payload: T
) => {
  const { sku, ...rest } = payload;
  const normalizedSku = normalizeSku(sku);

  return {
    ...rest,
    ...(normalizedSku ? { sku: normalizedSku } : {}),
  } as Omit<T, 'sku'> & { sku?: string };
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

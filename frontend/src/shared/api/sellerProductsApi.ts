import { Product } from '../types';
import { api } from './index';

export const sellerProductsApi = {
  list: async () => {
    const result = await api.getSellerProducts();
    return result.data;
  },
  create: async (product: Product) => {
    const result = await api.createSellerProduct({
      ...product,
      weightGrossG: product.weightGrossG ?? 0,
      dxCm: product.dxCm ?? 0,
      dyCm: product.dyCm ?? 0,
      dzCm: product.dzCm ?? 0,
      imageUrls: product.imageUrls ?? [],
      videoUrls: product.videoUrls ?? [],
    });
    return result.data;
  },
  update: async (product: Product) => {
    const result = await api.updateSellerProduct(product.id, product);
    return result.data;
  },
  remove: async (id: string) => {
    await api.removeSellerProduct(id);
  }
};

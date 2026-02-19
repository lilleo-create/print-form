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
      weightGrossG: product.weightGrossG,
      dxCm: product.dxCm,
      dyCm: product.dyCm,
      dzCm: product.dzCm,
      imageUrls: product.imageUrls ?? [],
      videoUrls: product.videoUrls ?? [],
    });
    return result.data;
  },
  update: async (product: Product) => {
    const result = await api.updateSellerProduct(product.id, { ...product });
    return result.data;
  },
  remove: async (id: string) => {
    await api.removeSellerProduct(id);
  }
};

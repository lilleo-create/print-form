import { Product } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { products as seedProducts } from './mockData';
import { api } from './index';

const getSeededProducts = () => {
  const stored = loadFromStorage<Product[]>(STORAGE_KEYS.sellerProducts, []);
  if (stored.length > 0) {
    return stored;
  }
  const initial = seedProducts.slice(0, 4);
  saveToStorage(STORAGE_KEYS.sellerProducts, initial);
  return initial;
};

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';

export const sellerProductsApi = {
  list: async () => {
    if (!useMock) {
      const result = await api.getSellerProducts();
      return result.data;
    }
    return getSeededProducts();
  },
  create: async (product: Product) => {
    if (!useMock) {
      const result = await api.createSellerProduct({
        ...product,
        imageUrls: product.imageUrls ?? [],
      });
      return result.data;
    }
    const current = getSeededProducts();
    const next = [product, ...current];
    saveToStorage(STORAGE_KEYS.sellerProducts, next);
    return product;
  },
  update: async (product: Product) => {
    if (!useMock) {
      const result = await api.updateSellerProduct(product.id, product);
      return result.data;
    }
    const current = getSeededProducts();
    const next = current.map((item) => (item.id === product.id ? product : item));
    saveToStorage(STORAGE_KEYS.sellerProducts, next);
    return product;
  },
  remove: async (id: string) => {
    if (!useMock) {
      await api.removeSellerProduct(id);
      return;
    }
    const current = getSeededProducts();
    const next = current.filter((item) => item.id !== id);
    saveToStorage(STORAGE_KEYS.sellerProducts, next);
  }
};

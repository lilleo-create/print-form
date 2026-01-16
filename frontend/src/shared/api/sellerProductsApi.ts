import { Product } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { products as seedProducts } from './mockData';

const getSeededProducts = () => {
  const stored = loadFromStorage<Product[]>(STORAGE_KEYS.sellerProducts, []);
  if (stored.length > 0) {
    return stored;
  }
  const initial = seedProducts.slice(0, 4);
  saveToStorage(STORAGE_KEYS.sellerProducts, initial);
  return initial;
};

export const sellerProductsApi = {
  list: async () => getSeededProducts(),
  create: async (product: Product) => {
    const current = getSeededProducts();
    const next = [product, ...current];
    saveToStorage(STORAGE_KEYS.sellerProducts, next);
    return product;
  },
  update: async (product: Product) => {
    const current = getSeededProducts();
    const next = current.map((item) => (item.id === product.id ? product : item));
    saveToStorage(STORAGE_KEYS.sellerProducts, next);
    return product;
  },
  remove: async (id: string) => {
    const current = getSeededProducts();
    const next = current.filter((item) => item.id !== id);
    saveToStorage(STORAGE_KEYS.sellerProducts, next);
  }
};

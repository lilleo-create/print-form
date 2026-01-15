import { Product } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { products as seedProducts } from './mockData';

const PRODUCTS_KEY = 'mock_seller_products';

const getSeededProducts = () => {
  const stored = loadFromStorage<Product[]>(PRODUCTS_KEY, []);
  if (stored.length > 0) {
    return stored;
  }
  const initial = seedProducts.slice(0, 4);
  saveToStorage(PRODUCTS_KEY, initial);
  return initial;
};

export const sellerProductsApi = {
  list: async () => getSeededProducts(),
  create: async (product: Product) => {
    const current = getSeededProducts();
    const next = [product, ...current];
    saveToStorage(PRODUCTS_KEY, next);
    return product;
  },
  update: async (product: Product) => {
    const current = getSeededProducts();
    const next = current.map((item) => (item.id === product.id ? product : item));
    saveToStorage(PRODUCTS_KEY, next);
    return product;
  },
  remove: async (id: string) => {
    const current = getSeededProducts();
    const next = current.filter((item) => item.id !== id);
    saveToStorage(PRODUCTS_KEY, next);
  }
};

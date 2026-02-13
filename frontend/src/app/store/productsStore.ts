import { create } from 'zustand';
import { Product } from '../../shared/types';
import { sellerProductsApi } from '../../shared/api/sellerProductsApi';
import { api } from '../../shared/api';

interface ProductsState {
  sellerProducts: Product[];
  allProducts: Product[];
  loadProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
}

export const useProductsStore = create<ProductsState>((set) => ({
  sellerProducts: [],
  allProducts: [],
  async loadProducts() {
    const [seller, catalog] = await Promise.all([
      sellerProductsApi.list(),
      api.getProducts()
    ]);
    set({ sellerProducts: seller, allProducts: catalog.data });
  },
  async addProduct(product) {
    await sellerProductsApi.create(product);
    set((state) => {
      const nextSeller = [product, ...state.sellerProducts];
      return { sellerProducts: nextSeller, allProducts: [...state.allProducts, product] };
    });
  },
  async updateProduct(product) {
    await sellerProductsApi.update(product);
    set((state) => {
      const nextSeller = state.sellerProducts.map((item) => (item.id === product.id ? product : item));
      const nextAll = state.allProducts.map((item) => (item.id === product.id ? product : item));
      return { sellerProducts: nextSeller, allProducts: nextAll };
    });
  },
  async removeProduct(id) {
    await sellerProductsApi.remove(id);
    set((state) => {
      const nextSeller = state.sellerProducts.filter((item) => item.id !== id);
      const nextAll = state.allProducts.filter((item) => item.id !== id);
      return { sellerProducts: nextSeller, allProducts: nextAll };
    });
  }
}));

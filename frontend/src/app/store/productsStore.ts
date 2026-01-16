import { create } from 'zustand';
import { sellerProductsApi } from '../../shared/api/sellerProductsApi';
import { Product } from '../../shared/types';

interface ProductsState {
  products: Product[];
  loadProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
}

export const useProductsStore = create<ProductsState>((set) => ({
  products: [],
  async loadProducts() {
    const data = await sellerProductsApi.list();
    set({ products: data });
  },
  async addProduct(product) {
    await sellerProductsApi.create(product);
    set((state) => ({ products: [product, ...state.products] }));
  },
  async updateProduct(product) {
    await sellerProductsApi.update(product);
    set((state) => ({ products: state.products.map((item) => (item.id === product.id ? product : item)) }));
  },
  async removeProduct(id) {
    await sellerProductsApi.remove(id);
    set((state) => ({ products: state.products.filter((item) => item.id !== id) }));
  }
}));

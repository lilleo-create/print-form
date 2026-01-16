import { create } from 'zustand';
import { Product } from '../../shared/types';
import { sellerProductsApi } from '../../shared/api/sellerProductsApi';
import { products as seedProducts } from '../../shared/api/mockData';

interface ProductsState {
  sellerProducts: Product[];
  allProducts: Product[];
  loadProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
}

const mergeProducts = (seller: Product[]) => [...seedProducts, ...seller];

export const useProductsStore = create<ProductsState>((set) => ({
  sellerProducts: [],
  allProducts: [...seedProducts],
  async loadProducts() {
    const seller = await sellerProductsApi.list();
    set({ sellerProducts: seller, allProducts: mergeProducts(seller) });
  },
  async addProduct(product) {
    await sellerProductsApi.create(product);
    set((state) => {
      const nextSeller = [product, ...state.sellerProducts];
      return { sellerProducts: nextSeller, allProducts: mergeProducts(nextSeller) };
    });
  },
  async updateProduct(product) {
    await sellerProductsApi.update(product);
    set((state) => {
      const nextSeller = state.sellerProducts.map((item) => (item.id === product.id ? product : item));
      return { sellerProducts: nextSeller, allProducts: mergeProducts(nextSeller) };
    });
  },
  async removeProduct(id) {
    await sellerProductsApi.remove(id);
    set((state) => {
      const nextSeller = state.sellerProducts.filter((item) => item.id !== id);
      return { sellerProducts: nextSeller, allProducts: mergeProducts(nextSeller) };
    });
  }
}));

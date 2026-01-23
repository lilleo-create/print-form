import { create } from 'zustand';
import { Product } from '../../shared/types';

interface ProductBoardState {
  product: Product | null;
  setProduct: (product: Product | null) => void;
}

export const useProductBoardStore = create<ProductBoardState>((set) => ({
  product: null,
  setProduct: (product) => set({ product })
}));

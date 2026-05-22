import { create } from 'zustand';
import { Product } from '../../shared/types';

interface ProductBoardState {
  product: Product | null;
  stickyVisible: boolean;
  setProduct: (product: Product | null) => void;
  setStickyVisible: (visible: boolean) => void;
}

export const useProductBoardStore = create<ProductBoardState>((set) => ({
  product: null,
  stickyVisible: false,
  setProduct: (product) => set({ product }),
  setStickyVisible: (visible) => set({ stickyVisible: visible }),
}));

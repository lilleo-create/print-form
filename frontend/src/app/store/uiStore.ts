import { create } from 'zustand';
import { Product } from '../../shared/types';

interface UiState {
  selectedProduct: Product | null;
  isCartOpen: boolean;
  openProduct: (product: Product) => void;
  closeProduct: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedProduct: null,
  isCartOpen: false,
  openProduct: (product) => set({ selectedProduct: product }),
  closeProduct: () => set({ selectedProduct: null }),
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false })
}));

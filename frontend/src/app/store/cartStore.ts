import { create } from 'zustand';
import { CartItem, Product } from '../../shared/types';

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (product, quantity) =>
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        };
      }
      return { items: [...state.items, { product, quantity }] };
    }),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    })),
  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((item) => item.product.id !== productId) })),
  clear: () => set({ items: [] })
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../../shared/types';

export type CartItem = {
  product: Product;
  quantity: number;
  addedAt?: number; // unix ms — set on add, used to detect "long in cart"
};

// Items that are this many ms old are shown in "Давно в корзине"
export const STALE_CART_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export type CartStore = {
  items: CartItem[];
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clear: () => void;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (product, quantity) =>
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { product, quantity, addedAt: Date.now() }],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId ? { ...i, quantity } : i
          ),
        })),

      clearCart: () => set({ items: [] }),
      clear: () => set({ items: [] }),
    }),
    { name: 'cart' }
  )
);

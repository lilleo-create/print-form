import { create } from 'zustand';
import { CartItem, Product } from '../../shared/types';
import { loadFromStorage, saveToStorage } from '../../shared/lib/storage';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const persist = (items: CartItem[]) => saveToStorage(STORAGE_KEYS.cart, items);

export const useCartStore = create<CartState>((set) => ({
  items: loadFromStorage<CartItem[]>(STORAGE_KEYS.cart, []),
  addItem: (product, quantity) =>
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id);
      const nextItems = existing
        ? state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [...state.items, { product, quantity }];
      persist(nextItems);
      return { items: nextItems };
    }),
  updateQuantity: (productId, quantity) =>
    set((state) => {
      const nextItems = state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
      persist(nextItems);
      return { items: nextItems };
    }),
  removeItem: (productId) =>
    set((state) => {
      const nextItems = state.items.filter((item) => item.product.id !== productId);
      persist(nextItems);
      return { items: nextItems };
    }),
  clear: () =>
    set(() => {
      persist([]);
      return { items: [] };
    })
}));

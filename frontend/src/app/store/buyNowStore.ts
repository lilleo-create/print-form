import { create } from 'zustand';
import { loadFromStorage, removeFromStorage, saveToStorage } from '../../shared/lib/storage';
import type { CartItem, Product } from '../../shared/types';

const BUY_NOW_STORAGE_KEY = 'printform_buy_now_state_v1';

type BuyNowState = {
  items: CartItem[];
  isActive: boolean;
  start: (product: Product, quantity?: number) => void;
  clear: () => void;
};

type PersistedBuyNowState = Pick<BuyNowState, 'items' | 'isActive'>;

const persist = (state: PersistedBuyNowState) => {
  if (!state.isActive || state.items.length === 0) {
    removeFromStorage(BUY_NOW_STORAGE_KEY);
    return;
  }
  saveToStorage(BUY_NOW_STORAGE_KEY, state);
};

const initial = loadFromStorage<PersistedBuyNowState>(BUY_NOW_STORAGE_KEY, {
  items: [],
  isActive: false
});

export const useBuyNowStore = create<BuyNowState>((set) => ({
  items: initial.items,
  isActive: initial.isActive,
  start: (product, quantity = 1) =>
    set(() => {
      const nextState = {
        items: [{ product, quantity }],
        isActive: true
      };
      persist(nextState);
      return nextState;
    }),
  clear: () =>
    set(() => {
      removeFromStorage(BUY_NOW_STORAGE_KEY);
      return { items: [], isActive: false };
    })
}));


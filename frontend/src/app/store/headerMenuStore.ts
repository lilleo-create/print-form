import { create } from 'zustand';

interface HeaderMenuState {
  isProfileMenuOpen: boolean;
  isSellerMenuOpen: boolean;
  isCategoriesMenuOpen: boolean;
  openProfileMenu: () => void;
  closeProfileMenu: () => void;
  closeSellerMenu: () => void;
  toggleSellerMenu: () => void;
  openCategoriesMenu: () => void;
  closeCategoriesMenu: () => void;
  toggleCategoriesMenu: () => void;
}

export const useHeaderMenuStore = create<HeaderMenuState>((set) => ({
  isProfileMenuOpen: false,
  isSellerMenuOpen: false,
  isCategoriesMenuOpen: false,
  openProfileMenu: () => set({ isProfileMenuOpen: true }),
  closeProfileMenu: () => set({ isProfileMenuOpen: false }),
  closeSellerMenu: () => set({ isSellerMenuOpen: false }),
  toggleSellerMenu: () => set((state) => ({ isSellerMenuOpen: !state.isSellerMenuOpen })),
  openCategoriesMenu: () => set({ isCategoriesMenuOpen: true }),
  closeCategoriesMenu: () => set({ isCategoriesMenuOpen: false }),
  toggleCategoriesMenu: () => set((state) => ({ isCategoriesMenuOpen: !state.isCategoriesMenuOpen }))
}));

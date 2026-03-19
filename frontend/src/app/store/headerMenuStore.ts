import { create } from 'zustand';

interface HeaderMenuState {
  isProfileMenuOpen: boolean;
  isSellerMenuOpen: boolean;
  openProfileMenu: () => void;
  closeProfileMenu: () => void;
  closeSellerMenu: () => void;
  toggleSellerMenu: () => void;
}

export const useHeaderMenuStore = create<HeaderMenuState>((set) => ({
  isProfileMenuOpen: false,
  isSellerMenuOpen: false,
  openProfileMenu: () => set({ isProfileMenuOpen: true }),
  closeProfileMenu: () => set({ isProfileMenuOpen: false }),
  closeSellerMenu: () => set({ isSellerMenuOpen: false }),
  toggleSellerMenu: () => set((state) => ({ isSellerMenuOpen: !state.isSellerMenuOpen }))
}));

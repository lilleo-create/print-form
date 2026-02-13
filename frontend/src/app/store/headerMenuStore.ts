import { create } from 'zustand';

interface HeaderMenuState {
  isProfileMenuOpen: boolean;
  openProfileMenu: () => void;
  closeProfileMenu: () => void;
}

export const useHeaderMenuStore = create<HeaderMenuState>((set) => ({
  isProfileMenuOpen: false,
  openProfileMenu: () => set({ isProfileMenuOpen: true }),
  closeProfileMenu: () => set({ isProfileMenuOpen: false })
}));

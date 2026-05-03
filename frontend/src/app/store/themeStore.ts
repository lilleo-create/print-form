import { create } from 'zustand';

type ThemeStore = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const getInitial = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.localStorage.getItem('theme') === 'light' ? 'light' : 'dark';

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: getInitial(),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('theme', next);
  },
}));

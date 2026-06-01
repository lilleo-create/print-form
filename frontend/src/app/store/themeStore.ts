import { create } from 'zustand';

type ThemeStore = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const getSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const getInitial = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  // No saved preference — follow the OS
  return getSystemTheme();
};

export const useThemeStore = create<ThemeStore>((set, get) => {
  // Listen for OS-level theme changes; only apply when user hasn't manually picked one
  if (typeof window !== 'undefined') {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (localStorage.getItem('theme')) return; // user has a manual override
        const next = e.matches ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        set({ theme: next });
      });
  }

  return {
    theme: getInitial(),
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      set({ theme: next });
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    },
  };
});

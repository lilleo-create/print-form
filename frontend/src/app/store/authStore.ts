import { create } from 'zustand';
import { authApi } from '../../shared/api/authApi';
import { User, Role } from '../../shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    phone: string;
    address: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => void;
}

const session = authApi.getSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: session?.user ?? null,
  token: session?.token ?? null,
  async login(email, password) {
    const result = await authApi.login(email, password);
    set({ user: result.user, token: result.token });
  },
  async register(payload) {
    const result = await authApi.register(payload);
    set({ user: result.user, token: result.token });
  },
  async logout() {
    await authApi.logout();
    set({ user: null, token: null });
  },
  hydrate() {
    const current = authApi.getSession();
    set({ user: current?.user ?? null, token: current?.token ?? null });
  }
}));

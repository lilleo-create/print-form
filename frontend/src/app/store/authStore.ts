import { create } from 'zustand';
import { authApi } from '../../shared/api/authApi';
import { User, Role } from '../../shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{
    requiresOtp: boolean;
    tempToken?: string;
    user?: User;
  }>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }) => Promise<{ requiresOtp: boolean; tempToken?: string; user?: User }>;
  requestOtp: (
    payload: { phone: string; purpose?: 'login' | 'register' | 'seller_verify' },
    token?: string | null
  ) => Promise<void>;
  verifyOtp: (payload: {
    phone: string;
    code: string;
    purpose?: 'login' | 'register' | 'seller_verify';
  }, token?: string | null) => Promise<void>;
  updateProfile: (payload: { name?: string; email?: string; phone?: string; address?: string }) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

const session = authApi.getSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: session?.user ?? null,
  token: session?.token ?? null,
  async login(email, password) {
    const result = await authApi.login(email, password);
    if ('requiresOtp' in result && result.requiresOtp) {
      return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
    }
    set({ user: result.user, token: result.token });
    return { requiresOtp: false };
  },
  async register(payload) {
    const result = await authApi.register(payload);
    if ('requiresOtp' in result && result.requiresOtp) {
      return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
    }
    set({ user: result.user, token: result.token });
    return { requiresOtp: false };
  },
  async requestOtp(payload, token) {
    await authApi.requestOtp(payload, token);
  },
  async verifyOtp(payload, token) {
    const result = await authApi.verifyOtp(payload, token);
    set({ user: result.user, token: result.token });
  },
  async updateProfile(payload) {
    const result = await authApi.updateProfile(payload);
    if (result?.user) {
      const user: User = {
        ...result.user,
        role: result.user.role as Role,
      };

      set({ user });
    }
  },
  setUser(user) {
    authApi.setSessionUser(user);
    set({ user });
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

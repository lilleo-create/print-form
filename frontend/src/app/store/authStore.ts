import { create } from 'zustand';
import { authApi, LoginPayload, RegisterPayload, UpdateProfilePayload } from '../../shared/api/authApi';
import { User, Role } from '../../shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

const session = authApi.getSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: session?.user ?? null,
  token: session?.token ?? null,
  async login(payload) {
    const result = await authApi.login(payload);
    set({ user: result.user, token: result.token });
  },
  async register(payload) {
    const result = await authApi.register(payload);
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

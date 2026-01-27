import { create } from 'zustand';
import { authApi } from '../../shared/api/authApi';
import { User, Role } from '../../shared/types';

type Purpose = 'login' | 'register' | 'seller_verify';

type OtpRequiredResult = {
  requiresOtp: true;
  tempToken: string;
  user: User;
};

type AuthSuccessResult = {
  requiresOtp: false;
  token: string;
  user: User;
};

type AuthResult = OtpRequiredResult | AuthSuccessResult;

const isOtpRequired = (r: AuthResult): r is OtpRequiredResult => r.requiresOtp === true;

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
  }) => Promise<{
    requiresOtp: boolean;
    tempToken?: string;
    user?: User;
  }>;

  requestOtp: (payload: { phone: string; purpose?: Purpose }, token?: string | null) => Promise<void>;

  verifyOtp: (
    payload: { phone: string; code: string; purpose?: Purpose },
    token?: string | null
  ) => Promise<void>;

  updateProfile: (payload: { name?: string; email?: string; phone?: string; address?: string }) => Promise<void>;

  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

const safeGetSession = () => {
  try {
    return authApi.getSession?.() ?? null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const session = safeGetSession();

  return {
    user: session?.user ?? null,
    token: session?.token ?? null,

    async login(email, password) {
      const raw = await authApi.login(email, password);

      if (!raw) {
        throw new Error('Login failed: empty response');
      }

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      // non-OTP success
      set({ user: result.user, token: result.token });
      return { requiresOtp: false };
    },

    async register(payload) {
      const raw = await authApi.register(payload);

      if (!raw) {
        throw new Error('Register failed: empty response');
      }

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      set({ user: result.user, token: result.token });
      return { requiresOtp: false };
    },

    async requestOtp(payload, token) {
      // purpose по умолчанию лучше явно проставлять на уровне UI,
      // но на всякий случай:
      const finalPayload = { purpose: 'login' as Purpose, ...payload };
      await authApi.requestOtp(finalPayload, token ?? get().token);
    },

    async verifyOtp(payload, token) {
      const finalPayload = { purpose: 'login' as Purpose, ...payload };
      const result = await authApi.verifyOtp(finalPayload, token ?? get().token);

      if (!result?.user || !result?.token) {
        throw new Error('OTP verify failed: invalid response');
      }

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
      // обновляем user в session если метод существует
      authApi.setSessionUser?.(user);
      set({ user });
    },

    async logout() {
      // Даже если бэк не поднят, локально мы обязаны "выйти"
      try {
        await authApi.logout();
      } catch {
        // намеренно игнорим, чтобы не ломать UI
      } finally {
        set({ user: null, token: null });
      }
    },

    hydrate() {
      const current = safeGetSession();
      set({ user: current?.user ?? null, token: current?.token ?? null });
    },
  };
});

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

  otp: {
    required: boolean;
    purpose: Purpose | null;
    tempToken: string | null;
    phone: string | null;
    user: User | null;
  };

  setOtpState: (v: Partial<AuthState['otp']>) => void;
  clearOtp: () => void;

  login: (email: string, password: string) => Promise<{
    requiresOtp: boolean;
    tempToken?: string;
    user?: User;
    token?: string;
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
    token?: string;
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

const emptyOtp: AuthState['otp'] = {
  required: false,
  purpose: null,
  tempToken: null,
  phone: null,
  user: null,
};

const AUTH_SESSION_KEY = 'auth_session_v1';
type AuthSession = { token: string; user: User };

const loadAuthSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

const saveAuthSession = (session: AuthSession | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!session) window.localStorage.removeItem(AUTH_SESSION_KEY);
    else window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // silent
  }
};

const safeGetSession = () => {
  try {
    return authApi.getSession?.() ?? null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const bootSession = loadAuthSession() ?? safeGetSession();

  return {
    user: bootSession?.user ?? null,
    token: bootSession?.token ?? null,

    otp: { ...emptyOtp },

    setOtpState(v) {
      set({ otp: { ...get().otp, ...v } });
    },

    clearOtp() {
      set({ otp: { ...emptyOtp } });
    },

    async login(email, password) {
      get().clearOtp();

      const raw = await authApi.login(email, password);
      if (!raw) throw new Error('Login failed: empty response');

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        set({
          otp: {
            required: true,
            purpose: 'login',
            tempToken: result.tempToken,
            phone: result.user.phone ?? null,
            user: result.user,
          },
        });
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      set({ user: result.user, token: result.token });
      saveAuthSession({ user: result.user, token: result.token });
      return { requiresOtp: false, user: result.user, token: result.token };
    },

    async register(payload) {
      get().clearOtp();

      const raw = await authApi.register(payload);
      if (!raw) throw new Error('Register failed: empty response');

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        set({
          otp: {
            required: true,
            purpose: 'register',
            tempToken: result.tempToken,
            phone: payload.phone ?? result.user.phone ?? null,
            user: result.user,
          },
        });
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      set({ user: result.user, token: result.token });
      saveAuthSession({ user: result.user, token: result.token });
      return { requiresOtp: false, user: result.user, token: result.token };
    },

    async requestOtp(payload, token) {
      const purpose = (payload.purpose ?? get().otp.purpose ?? 'login') as Purpose;
      const finalPayload = { ...payload, purpose };

      await authApi.requestOtp(finalPayload, token ?? get().otp.tempToken ?? get().token);
    },

    async verifyOtp(payload, token) {
      const otp = get().otp;
      const purpose = (payload.purpose ?? otp.purpose ?? 'login') as Purpose;

      const finalPayload = { ...payload, purpose };
      const result = await authApi.verifyOtp(finalPayload, token ?? otp.tempToken ?? get().token);

      if (!result?.user || !result?.token) {
        throw new Error('OTP verify failed: invalid response');
      }

      set({
        user: result.user,
        token: result.token,
        otp: { ...emptyOtp },
      });
      saveAuthSession({ user: result.user, token: result.token });
    },

    async updateProfile(payload) {
      const result = await authApi.updateProfile(payload);

      if (result?.user) {
        const user: User = {
          ...result.user,
          role: result.user.role as Role,
        };
        set({ user });

        // обновим сохранённую сессию, если есть token
        const token = get().token;
        if (token) saveAuthSession({ user, token });
      }
    },

    setUser(user) {
      authApi.setSessionUser?.(user);
      set({ user });

      const token = get().token;
      if (token) saveAuthSession({ user, token });
    },

    async logout() {
      try {
        await authApi.logout();
      } catch {
        // ignore
      } finally {
        saveAuthSession(null);
        set({ user: null, token: null, otp: { ...emptyOtp } });
      }
    },

    hydrate() {
      const current = loadAuthSession() ?? safeGetSession();
      set({ user: current?.user ?? null, token: current?.token ?? null });
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    saveAuthSession(null);
    useAuthStore.setState({ user: null, token: null, otp: { ...emptyOtp } });
  });
}

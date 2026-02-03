import type { User, Role } from '../types';
import { loadFromStorage, removeFromStorage, saveToStorage, setAccessToken } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { api } from './index';

interface StoredSession {
  user: User;
}

type AuthResult =
  | { requiresOtp: true; tempToken: string; user: User }
  | { requiresOtp: false; token: string; user: User };

type RawUser = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  role?: string;
};

type RawAuthData = {
  requiresOtp?: boolean;
  requires_otp?: boolean;
  tempToken?: string;
  temp_token?: string;
  accessToken?: string;
  user?: RawUser;
};

const normalizeRole = (role?: string): Role => {
  const r = (role ?? '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'seller') return 'seller';
  return 'buyer';
};

const normalizeUser = (u?: RawUser): User => ({
  id: u?.id ?? '',
  name: u?.name ?? '',
  email: u?.email ?? '',
  phone: u?.phone ?? null,
  address: u?.address ?? null,
  role: normalizeRole(u?.role)
});

function requireUser(data: RawAuthData, context: string): User {
  if (!data.user) {
    throw new Error(`${context}: user missing in response`);
  }
  return normalizeUser(data.user);
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResult> => {
    const result = await api.login({ email, password });
    const data = result.data as RawAuthData;

    const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
    const tempToken = data.tempToken ?? data.temp_token ?? '';

    if (requiresOtp) {
      return {
        requiresOtp: true,
        tempToken,
        user: requireUser(data, 'Login')
      };
    }

    const token = data.accessToken ?? '';
    const user = requireUser(data, 'Login');

    return { requiresOtp: false, token, user };
  },

  register: async (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }): Promise<AuthResult> => {
    const result = await api.register({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      address: payload.address,
      privacyAccepted: payload.privacyAccepted
    });

    const data = result.data as RawAuthData;

    const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
    const tempToken = data.tempToken ?? data.temp_token ?? '';

    if (requiresOtp) {
      return {
        requiresOtp: true,
        tempToken,
        user: requireUser(data, 'Register')
      };
    }

    const token = data.accessToken ?? '';
    const user = requireUser(data, 'Register');

    return { requiresOtp: false, token, user };
  },

  requestOtp: async (
    payload: { phone: string; purpose?: 'login' | 'register' | 'seller_verify' },
    token?: string | null
  ) => {
    return api.requestOtp(payload, token);
  },

  verifyOtp: async (
    payload: { phone: string; code: string; purpose?: 'login' | 'register' | 'seller_verify' },
    token?: string | null
  ) => {
    const result = await api.verifyOtp(payload, token);

    const data = result.data as { accessToken?: string; user?: RawUser };

    const session = {
      token: data.accessToken ?? '',
      user: normalizeUser(data.user)
    };

    if (!session.token || !session.user.id) {
      throw new Error('OTP verify: invalid response');
    }
    return session;
  },

  updateProfile: async (payload: { name?: string; email?: string; phone?: string; address?: string }) => {
    const result = await api.updateProfile(payload);
    const updatedUser = result.data?.data as RawUser | undefined;
    if (!updatedUser) return null;
    return { user: normalizeUser(updatedUser) };
  },

  logout: async () => {
    await api.logout();
    removeFromStorage(STORAGE_KEYS.session);
    setAccessToken(null);
  },

  getSession: () => {
    const session = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
    const token = loadFromStorage<string | null>(STORAGE_KEYS.accessToken, null);
    if (!session?.user && !token) return null;
    return { user: session?.user ?? null, token };
  },

  setSessionUser: (user: User) => {
    if (!user) {
      removeFromStorage(STORAGE_KEYS.session);
      return null;
    }
    const nextSession = { user };
    saveToStorage(STORAGE_KEYS.session, nextSession);
    return nextSession;
  }
};

import type { User, Role } from '../types';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { api } from './index';

interface StoredSession {
  token: string;
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
  token?: string;
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

    const token = data.token ?? '';
    const user = requireUser(data, 'Login');

    const session: StoredSession = { token, user };
    saveToStorage(STORAGE_KEYS.session, session);

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

    const token = data.token ?? '';
    const user = requireUser(data, 'Register');

    const session: StoredSession = { token, user };
    saveToStorage(STORAGE_KEYS.session, session);

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

    // verifyOtp на бэке обычно возвращает {token, user}
    const data = result.data as { token?: string; user?: RawUser };

    const session: StoredSession = {
      token: data.token ?? '',
      user: normalizeUser(data.user)
    };

    if (!session.token || !session.user.id) {
      throw new Error('OTP verify: invalid response');
    }

    saveToStorage(STORAGE_KEYS.session, session);
    return session;
  },

  updateProfile: async (payload: { name?: string; email?: string; phone?: string; address?: string }) => {
    const result = await api.updateProfile(payload);

    const current = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
    if (!current) return null;

    const updatedUser = result.data?.data as RawUser | undefined;

    const nextSession: StoredSession = {
      ...current,
      user: {
        ...current.user,
        ...(updatedUser ? normalizeUser(updatedUser) : {})
      }
    };

    saveToStorage(STORAGE_KEYS.session, nextSession);
    return nextSession;
  },

  logout: async () => {
    await api.logout();
    removeFromStorage(STORAGE_KEYS.session);
  },

  getSession: () => loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null),

  setSessionUser: (user: User) => {
    const current = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
    if (!current) return null;
    const nextSession = { ...current, user };
    saveToStorage(STORAGE_KEYS.session, nextSession);
    return nextSession;
  }
};

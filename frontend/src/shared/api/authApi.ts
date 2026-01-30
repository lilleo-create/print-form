import { User, Role } from '../types';
import {
  loadFromStorage,
  saveToStorage,
  removeFromStorage
} from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { api } from './index';

interface StoredSession {
  token: string;
  user: User;
}

type AuthResult =
  | { requiresOtp: true; tempToken: string; user: User }
  | { requiresOtp: false; token: string; user: User };

// Поддержка snake_case и camelCase из бэка
type RawAuthData = {
  requiresOtp?: boolean;
  requires_otp?: boolean;
  tempToken?: string;
  temp_token?: string;
  token?: string;
  user?: any;
};

const normalizeRole = (role: string): Role =>
  role?.toLowerCase() === 'admin' ? 'admin' : role?.toLowerCase() === 'seller' ? 'seller' : 'buyer';

export const authApi = {
  login: async (email: string, password: string) => {
    const result = await api.login({ email, password });
    const data = (result.data ?? {}) as RawAuthData;

    const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
    const tempToken = data.tempToken ?? data.temp_token ?? '';

    if (requiresOtp) {
      return {
        requiresOtp: true,
        tempToken,
        user: { ...data.user, role: normalizeRole(data.user.role) }
      } as AuthResult;
    }

    const session: StoredSession = {
      token: data.token ?? '',
      user: { ...data.user, role: normalizeRole(data.user.role) }
    };
    saveToStorage(STORAGE_KEYS.session, session);

    return {
      requiresOtp: false,
      token: session.token,
      user: session.user
    } as AuthResult;
  },

  register: async (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }) => {
    const result = await api.register({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      address: payload.address,
      privacyAccepted: payload.privacyAccepted
    });

    const data = (result.data ?? {}) as RawAuthData;

    const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
    const tempToken = data.tempToken ?? data.temp_token ?? '';

    if (requiresOtp) {
      return {
        requiresOtp: true,
        tempToken,
        user: { ...data.user, role: normalizeRole(data.user.role) }
      } as AuthResult;
    }

    const session: StoredSession = {
      token: data.token ?? '',
      user: { ...data.user, role: normalizeRole(data.user.role) }
    };
    saveToStorage(STORAGE_KEYS.session, session);

    return {
      requiresOtp: false,
      token: session.token,
      user: session.user
    } as AuthResult;
  },

  requestOtp: async (
    payload: {
      phone: string;
      purpose?: 'login' | 'register' | 'seller_verify';
    },
    token?: string | null
  ) => {
    return api.requestOtp(payload, token);
  },

  verifyOtp: async (
    payload: {
      phone: string;
      code: string;
      purpose?: 'login' | 'register' | 'seller_verify';
    },
    token?: string | null
  ) => {
    const result = await api.verifyOtp(payload, token);
    const data = (result.data ?? {}) as any;

    const session: StoredSession = {
      token: data.token,
      user: { ...data.user, role: normalizeRole(data.user.role) }
    };

    saveToStorage(STORAGE_KEYS.session, session);
    return session;
  },

  updateProfile: async (payload: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) => {
    const result = await api.updateProfile(payload);
    const current = loadFromStorage<StoredSession | null>(
      STORAGE_KEYS.session,
      null
    );
    if (current) {
      const nextSession = {
        ...current,
        user: { ...current.user, ...(result.data?.data ?? {}) }
      };
      saveToStorage(STORAGE_KEYS.session, nextSession);
      return nextSession;
    }
    return null;
  },

  logout: async () => {
    await api.logout();
    removeFromStorage(STORAGE_KEYS.session);
  },

  getSession: () =>
    loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null),

  setSessionUser: (user: User) => {
    const current = loadFromStorage<StoredSession | null>(
      STORAGE_KEYS.session,
      null
    );
    if (!current) return null;
    const nextSession = { ...current, user };
    saveToStorage(STORAGE_KEYS.session, nextSession);
    return nextSession;
  }
};

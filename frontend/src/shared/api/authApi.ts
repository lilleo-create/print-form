import { User, Role } from '../types';
import {
  loadFromStorage,
  saveToStorage,
  removeFromStorage
} from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { api } from './index';

interface UserRecord extends User {
  password: string;
  createdAt: string;
}

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

const now = () => new Date().toISOString();
const useMock = import.meta.env.VITE_USE_MOCK === 'true';

const normalizeRole = (role: string): Role =>
  role?.toLowerCase() === 'seller' ? 'seller' : 'buyer';

const normPhone = (v: string) => (v ?? '').replace(/\D/g, '');

const seedUsers = (): UserRecord[] => {
  const existing = loadFromStorage<UserRecord[]>(STORAGE_KEYS.users, []);
  if (existing.length > 0) return existing;

  const seeded: UserRecord[] = [
    {
      id: 'buyer-1',
      name: 'Покупатель',
      email: 'buyer@test.com',
      phone: '+7 (977) 811-75-27',
      address: 'Москва, ул. Тверская, 12',
      role: 'buyer',
      password: 'buyer123',
      createdAt: now()
    },
    {
      id: 'seller-1',
      name: 'Продавец',
      email: 'seller@test.com',
      phone: '+7 (977) 811-75-27',
      address: 'Санкт-Петербург, Невский пр., 78',
      role: 'seller',
      password: 'seller123',
      createdAt: now()
    }
  ];

  saveToStorage(STORAGE_KEYS.users, seeded);
  return seeded;
};

const getUsers = () =>
  loadFromStorage<UserRecord[]>(STORAGE_KEYS.users, seedUsers());

export const authApi = {
  login: async (email: string, password: string) => {
    if (!useMock) {
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
    }

    // MOCK
    const users = getUsers();
    const user = users.find(
      (u) => u.email === email && u.password === password
    );
    if (!user) throw new Error('INVALID_CREDENTIALS');

    return {
      requiresOtp: true,
      tempToken: `otp-${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address
      }
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
    if (!useMock) {
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
    }

    // MOCK
    const users = getUsers();
    if (users.some((u) => u.email === payload.email))
      throw new Error('USER_EXISTS');

    const newUser: UserRecord = {
      id: `user-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      role: payload.role ?? 'buyer',
      password: payload.password,
      createdAt: now()
    };

    const nextUsers = [...users, newUser];
    saveToStorage(STORAGE_KEYS.users, nextUsers);

    return {
      requiresOtp: true,
      tempToken: `otp-${Date.now()}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        address: newUser.address
      }
    } as AuthResult;
  },

  requestOtp: async (
    payload: {
      phone: string;
      purpose?: 'login' | 'register' | 'seller_verify';
    },
    token?: string | null
  ) => {
    if (!useMock) {
      return api.requestOtp(payload, token);
    }

    // MOCK: храним код на номер, а не один на всех
    const code = '000000';
    const key = `${STORAGE_KEYS.otpCode}:${normPhone(payload.phone)}`;
    saveToStorage(key, code);

    return { data: { ok: true, devOtp: code } };
  },

  verifyOtp: async (
    payload: {
      phone: string;
      code: string;
      purpose?: 'login' | 'register' | 'seller_verify';
    },
    token?: string | null
  ) => {
    if (!useMock) {
      const result = await api.verifyOtp(payload, token);
      const data = (result.data ?? {}) as any;

      const session: StoredSession = {
        token: data.token,
        user: { ...data.user, role: normalizeRole(data.user.role) }
      };

      saveToStorage(STORAGE_KEYS.session, session);
      return session;
    }

    // MOCK
    const key = `${STORAGE_KEYS.otpCode}:${normPhone(payload.phone)}`;
    const storedCode = loadFromStorage<string | null>(key, null);

    if (!storedCode || storedCode !== payload.code) {
      throw new Error('OTP_INVALID');
    }

    const users = getUsers();

    // ВАЖНО: сравниваем телефоны нормализованно
    const user = users.find(
      (u) => normPhone(u.phone ?? '') === normPhone(payload.phone ?? '')
    );
    if (!user) throw new Error('OTP_USER_NOT_FOUND');

    const session: StoredSession = {
      token: `token-${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address
      }
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
    if (!useMock) {
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
    }

    const session = loadFromStorage<StoredSession | null>(
      STORAGE_KEYS.session,
      null
    );
    if (!session) return null;

    const users = getUsers();
    const nextUsers = users.map((u) =>
      u.id === session.user.id ? { ...u, ...payload } : u
    );
    saveToStorage(STORAGE_KEYS.users, nextUsers);

    const nextSession = { ...session, user: { ...session.user, ...payload } };
    saveToStorage(STORAGE_KEYS.session, nextSession);
    return nextSession;
  },

  logout: async () => {
    if (!useMock) {
      await api.logout();
    }
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

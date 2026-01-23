import { User, Role } from '../types';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../lib/storage';
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

const now = () => new Date().toISOString();
const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const normalizeRole = (role: string): Role => (role.toLowerCase() === 'seller' ? 'seller' : 'buyer');

const seedUsers = (): UserRecord[] => {
  const existing = loadFromStorage<UserRecord[]>(STORAGE_KEYS.users, []);
  if (existing.length > 0) {
    return existing;
  }
  const seeded: UserRecord[] = [
    {
      id: 'buyer-1',
      name: 'Покупатель',
      email: 'buyer@test.com',
      phone: '+7 (900) 123-45-67',
      address: 'Москва, ул. Тверская, 12',
      role: 'buyer',
      password: 'buyer123',
      createdAt: now()
    },
    {
      id: 'seller-1',
      name: 'Продавец',
      email: 'seller@test.com',
      phone: '+7 (900) 555-11-22',
      address: 'Санкт-Петербург, Невский пр., 78',
      role: 'seller',
      password: 'seller123',
      createdAt: now()
    }
  ];
  saveToStorage(STORAGE_KEYS.users, seeded);
  return seeded;
};

const getUsers = () => loadFromStorage<UserRecord[]>(STORAGE_KEYS.users, seedUsers());

export const authApi = {
  login: async (email: string, password: string) => {
    if (!useMock) {
      const result = await api.login({ email, password });
      const session: StoredSession = {
        token: result.data.token,
        user: { ...result.data.user, role: normalizeRole(result.data.user.role) }
      };
      saveToStorage(STORAGE_KEYS.session, session);
      return session;
    }
    const users = getUsers();
    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
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
  register: async (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    phone?: string;
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
      const session: StoredSession = {
        token: result.data.token,
        user: { ...result.data.user, role: normalizeRole(result.data.user.role) }
      };
      saveToStorage(STORAGE_KEYS.session, session);
      return session;
    }
    const users = getUsers();
    if (users.some((item) => item.email === payload.email)) {
      throw new Error('USER_EXISTS');
    }
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
    const session: StoredSession = {
      token: `token-${Date.now()}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        address: newUser.address
      }
    };
    saveToStorage(STORAGE_KEYS.session, session);
    return session;
  },
  updateProfile: async (payload: { name?: string; phone?: string; address?: string }) => {
    if (!useMock) {
      const result = await api.updateProfile(payload);
      const current = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
      if (current) {
        const nextSession = { ...current, user: { ...current.user, ...result.data.data } };
        saveToStorage(STORAGE_KEYS.session, nextSession);
        return nextSession;
      }
      return null;
    }
    const session = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
    if (!session) {
      return null;
    }
    const users = getUsers();
    const nextUsers = users.map((item) =>
      item.id === session.user.id ? { ...item, ...payload } : item
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
  getSession: () => loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null)
};

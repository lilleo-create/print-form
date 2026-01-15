import { User, Role } from '../types';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../lib/storage';

const USERS_KEY = 'mock_users';
const SESSION_KEY = 'mock_session';

interface UserRecord extends User {
  password: string;
}

interface StoredSession {
  token: string;
  user: User;
}

const seedUsers = (): UserRecord[] => {
  const existing = loadFromStorage<UserRecord[]>(USERS_KEY, []);
  if (existing.length > 0) {
    return existing;
  }
  const seeded: UserRecord[] = [
    {
      id: 'buyer-1',
      name: 'Алина Смирнова',
      email: 'buyer@3dmarket.ru',
      role: 'buyer',
      password: 'password123'
    },
    {
      id: 'seller-1',
      name: 'Никита Белов',
      email: 'seller@3dmarket.ru',
      role: 'seller',
      password: 'password123'
    }
  ];
  saveToStorage(USERS_KEY, seeded);
  return seeded;
};

const getUsers = () => loadFromStorage<UserRecord[]>(USERS_KEY, seedUsers());

export const authApi = {
  login: async (email: string, password: string) => {
    const users = getUsers();
    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const session: StoredSession = {
      token: `token-${Date.now()}`,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
    saveToStorage(SESSION_KEY, session);
    return session;
  },
  register: async (payload: { name: string; email: string; password: string; role?: Role }) => {
    const users = getUsers();
    if (users.some((item) => item.email === payload.email)) {
      throw new Error('USER_EXISTS');
    }
    const newUser: UserRecord = {
      id: `user-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      role: payload.role ?? 'buyer',
      password: payload.password
    };
    const nextUsers = [...users, newUser];
    saveToStorage(USERS_KEY, nextUsers);
    const session: StoredSession = {
      token: `token-${Date.now()}`,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    };
    saveToStorage(SESSION_KEY, session);
    return session;
  },
  logout: async () => {
    removeFromStorage(SESSION_KEY);
  },
  getSession: () => loadFromStorage<StoredSession | null>(SESSION_KEY, null)
};

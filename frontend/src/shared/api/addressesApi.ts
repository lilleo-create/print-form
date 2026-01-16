import { Address } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const addressesKey = (userId: string) => `${STORAGE_KEYS.addresses}_${userId}`;
const defaultKey = (userId: string) => `${STORAGE_KEYS.defaultAddressPrefix}${userId}`;

export const addressesApi = {
  listByUser: async (userId: string) => {
    return loadFromStorage<Address[]>(addressesKey(userId), []);
  },
  create: async (payload: Omit<Address, 'id' | 'createdAt'>) => {
    const existing = loadFromStorage<Address[]>(addressesKey(payload.userId), []);
    const newAddress: Address = {
      ...payload,
      id: `address-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    saveToStorage(addressesKey(payload.userId), [newAddress, ...existing]);
    return newAddress;
  },
  update: async (payload: Address) => {
    const existing = loadFromStorage<Address[]>(addressesKey(payload.userId), []);
    const next = existing.map((address) => (address.id === payload.id ? payload : address));
    saveToStorage(addressesKey(payload.userId), next);
    return payload;
  },
  remove: async (userId: string, addressId: string) => {
    const existing = loadFromStorage<Address[]>(addressesKey(userId), []);
    const next = existing.filter((address) => address.id !== addressId);
    saveToStorage(addressesKey(userId), next);
  },
  setDefault: async (userId: string, addressId: string) => {
    saveToStorage(defaultKey(userId), addressId);
  },
  getDefault: async (userId: string) => loadFromStorage<string | null>(defaultKey(userId), null)
};

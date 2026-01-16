import { Address } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const addressesKey = (userId: string) => `${STORAGE_KEYS.addresses}_${userId}`;
const defaultKey = (userId: string) => `${STORAGE_KEYS.defaultAddressPrefix}${userId}`;

type LegacyAddress = {
  id: string;
  userId: string;
  label?: string;
  city?: string;
  street?: string;
  house?: string;
  apt?: string;
  comment?: string;
  coords?: {
    lat: number;
    lon: number;
  };
  createdAt: string;
};

const normalizeAddress = (address: Address | LegacyAddress): Address => {
  if ('addressText' in address) {
    return {
      ...address,
      coords: address.coords ?? null
    };
  }

  const city = address.city ?? '';
  const street = address.street ?? '';
  const house = address.house ?? '';
  const apt = address.apt ?? '';
  const addressParts = [city, street, house].filter(Boolean).join(', ');
  const addressText = addressParts || 'Адрес не указан';

  return {
    id: address.id,
    userId: address.userId,
    coords: address.coords ?? null,
    addressText,
    apartment: apt || undefined,
    floor: undefined,
    label: address.label,
    isFavorite: Boolean(address.label),
    courierComment: address.comment,
    createdAt: address.createdAt
  };
};

export const addressesApi = {
  listByUser: async (userId: string) => {
    const stored = loadFromStorage<Array<Address | LegacyAddress>>(addressesKey(userId), []);
    const normalized = stored.map(normalizeAddress);
    const shouldPersist = stored.some((item) => !('addressText' in item));
    if (shouldPersist) {
      saveToStorage(addressesKey(userId), normalized);
    }
    return normalized;
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

import { Address } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const getAddresses = () => loadFromStorage<Address[]>(STORAGE_KEYS.addresses, []);

export const addressesApi = {
  listByUser: async (userId: string) => {
    const addresses = getAddresses();
    return addresses.filter((address) => address.userId === userId);
  },
  create: async (payload: Omit<Address, 'id' | 'createdAt'>) => {
    const addresses = getAddresses();
    const newAddress: Address = {
      ...payload,
      id: `address-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    saveToStorage(STORAGE_KEYS.addresses, [newAddress, ...addresses]);
    return newAddress;
  },
  setDefault: async (userId: string, addressId: string) => {
    saveToStorage(`${STORAGE_KEYS.defaultAddressPrefix}${userId}`, addressId);
  },
  getDefault: async (userId: string) =>
    loadFromStorage<string | null>(`${STORAGE_KEYS.defaultAddressPrefix}${userId}`, null)
};

import { create } from 'zustand';
import { Address } from '../../shared/types';
import { addressesApi } from '../../shared/api/addressesApi';

interface AddressState {
  addresses: Address[];
  selectedAddressId: string;
  isModalOpen: boolean;
  loadAddresses: (userId: string) => Promise<void>;
  selectAddress: (userId: string, addressId: string) => Promise<void>;
  addAddress: (payload: Omit<Address, 'id' | 'createdAt'>) => Promise<Address>;
  updateAddress: (payload: Address) => Promise<Address>;
  removeAddress: (userId: string, addressId: string) => Promise<void>;
  reset: () => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useAddressStore = create<AddressState>((set) => ({
  addresses: [],
  selectedAddressId: '',
  isModalOpen: false,
  async loadAddresses(userId) {
    try {
      const data = await addressesApi.listByUser(userId);
      const defaultId = await addressesApi.getDefault(userId);
      const nextSelected = defaultId ?? data[0]?.id ?? '';
      if (nextSelected && nextSelected !== defaultId) {
        await addressesApi.setDefault(userId, nextSelected);
      }
      set({ addresses: data, selectedAddressId: nextSelected });
    } catch {
      set({ addresses: [], selectedAddressId: '' });
    }
  },
  async selectAddress(userId, addressId) {
    await addressesApi.setDefault(userId, addressId);
    set({ selectedAddressId: addressId });
  },
  async addAddress(payload) {
    const created = await addressesApi.create(payload);
    set((state) => ({ addresses: [created, ...state.addresses] }));
    return created;
  },
  async updateAddress(payload) {
    const updated = await addressesApi.update(payload);
    set((state) => ({
      addresses: state.addresses.map((address) => (address.id === updated.id ? updated : address))
    }));
    return updated;
  },
  async removeAddress(userId, addressId) {
    await addressesApi.remove(userId, addressId);
    set((state) => ({
      addresses: state.addresses.filter((address) => address.id !== addressId)
    }));
  },
  reset: () => set({ addresses: [], selectedAddressId: '' }),
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false })
}));

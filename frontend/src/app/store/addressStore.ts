import { create } from 'zustand';
import type { Address } from '../../shared/types';
import { addressesApi } from '../../shared/api/addressesApi';

interface AddressState {
  addresses: Address[];
  selectedAddressId: string;
  isModalOpen: boolean;

  loadAddresses: (userId: string, signal?: AbortSignal) => Promise<Address[]>;
  selectAddress: (userId: string, addressId: string, signal?: AbortSignal) => Promise<void>;

  addAddress: (payload: Omit<Address, 'id' | 'createdAt'>, signal?: AbortSignal) => Promise<Address>;
  updateAddress: (payload: Address, signal?: AbortSignal) => Promise<Address>;
  removeAddress: (userId: string, addressId: string, signal?: AbortSignal) => Promise<void>;

  reset: () => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddressId: '',
  isModalOpen: false,

  async loadAddresses(userId, signal) {
    try {
      const data = await addressesApi.listByUser(userId, signal);
      if (signal?.aborted) return data;

      const defaultId = await addressesApi.getDefault(userId, signal);
      if (signal?.aborted) return data;

      const nextSelected = defaultId ?? data[0]?.id ?? '';

      // если дефолта нет вообще, но адреса есть — назначим один раз
      if (!defaultId && nextSelected) {
        await addressesApi.setDefault(userId, nextSelected, signal);
        if (signal?.aborted) return data;
      }

      set({ addresses: data, selectedAddressId: nextSelected });
      return data;
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return get().addresses;
      }
      set({ addresses: [], selectedAddressId: '' });
      return [];
    }
  },

  async selectAddress(userId, addressId, signal) {
    await addressesApi.setDefault(userId, addressId, signal);
    if (signal?.aborted) return;
    set({ selectedAddressId: addressId });
  },

  async addAddress(payload, signal) {
    const created = await addressesApi.create(payload, signal);
    if (signal?.aborted) return created;
    set((state) => ({ addresses: [created, ...state.addresses] }));
    return created;
  },

  async updateAddress(payload, signal) {
    const updated = await addressesApi.update(payload, signal);
    if (signal?.aborted) return updated;

    set((state) => ({
      addresses: state.addresses.map((a) => (a.id === updated.id ? updated : a))
    }));
    return updated;
  },

  async removeAddress(userId, addressId, signal) {
    await addressesApi.remove(userId, addressId, signal);
    if (signal?.aborted) return;

    set((state) => ({
      addresses: state.addresses.filter((a) => a.id !== addressId)
    }));

    // если удалили выбранный — выбираем fallback
    const state = get();
    if (state.selectedAddressId === addressId) {
      const fallbackId = state.addresses[0]?.id ?? '';
      set({ selectedAddressId: fallbackId });
      if (fallbackId) {
        try {
          await addressesApi.setDefault(userId, fallbackId, signal);
        } catch {}
      }
    }
  },

  reset: () => set({ addresses: [], selectedAddressId: '' }),
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false })
}));

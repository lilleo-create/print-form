import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address } from '../../shared/types';

type AddressStore = {
  address: Address | null;
  addresses: Address[];
  selectedAddressId: string | null;
  setAddress: (address: Address) => void;
  addAddress: (payload: Omit<Address, 'id' | 'createdAt'>, userId?: string) => Promise<Address>;
  selectAddress: (userIdOrId: string, addressId?: string) => Promise<void>;
  updateAddress: (address: Address, userId?: string) => Promise<Address>;
  removeAddress: (userIdOrId: string, addressId?: string) => Promise<void>;
  clearAddress: () => void;
};

export const useAddressStore = create<AddressStore>()(
  persist(
    (set, get) => ({
      address: null,
      addresses: [],
      selectedAddressId: null,

      setAddress: (address) => set({ address }),

      addAddress: async (payload, _userId?) => {
        const newAddress = { ...payload, id: String(Date.now()), createdAt: new Date().toISOString() } as Address;
        set((state) => ({ addresses: [...state.addresses, newAddress] }));
        return newAddress;
      },

      selectAddress: async (userIdOrId, addressId?) => {
        const id = addressId ?? userIdOrId;
        const found = get().addresses.find((a) => a.id === id);
        set({ selectedAddressId: id, address: found ?? null });
      },

      updateAddress: async (address, _userId?) => {
        set((state) => ({
          addresses: state.addresses.map((a) => (a.id === address.id ? address : a)),
          address: state.address?.id === address.id ? address : state.address
        }));
        return address;
      },

      removeAddress: async (userIdOrId, addressId?) => {
        const id = addressId ?? userIdOrId;
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
          selectedAddressId: state.selectedAddressId === id ? null : state.selectedAddressId
        }));
      },

      clearAddress: () => set({ address: null })
    }),
    { name: 'address' }
  )
);

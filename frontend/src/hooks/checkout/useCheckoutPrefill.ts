import { useState } from 'react';
import type { Address, Contact } from '../../shared/types';

type CheckoutPrefillOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: Record<string, any> | null;
  keepPreviousData?: boolean;
  ttlMs?: number;
};

export const useCheckoutPrefill = (_options?: CheckoutPrefillOptions) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses] = useState<Address[]>([]);
  const [selectedAddressId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return {
    defaultValues: { name: '', email: '', phone: '' },
    savedAddress: null,
    contacts,
    setContacts,
    addresses,
    selectedAddressId,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false)
  };
};

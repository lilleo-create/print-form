import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { contactsApi } from '../../shared/api/contactsApi';
import type { Address, Contact, User } from '../../shared/types';
import { useAddressStore } from '../../app/store/addressStore';

export type PrefillStatus = 'idle' | 'loading' | 'success' | 'error';

type UseCheckoutPrefillArgs = {
  user: User | null;
  token: string | null;
  pathname: string;
  keepPreviousData?: boolean;
  ttlMs?: number;
};

type PrefillCacheEntry = {
  timestamp: number;
  contacts: Contact[];
  addressesSnapshot: Address[];
  selectedAddressId: string;
};

type UseCheckoutPrefillResult = {
  contacts: Contact[];
  setContacts: Dispatch<SetStateAction<Contact[]>>;
  addresses: Address[];
  selectedAddressId: string;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  status: PrefillStatus;
  error: string | null;
};

const cache = new Map<string, PrefillCacheEntry>();

export const useCheckoutPrefill = ({
  user,
  token,
  pathname,
  keepPreviousData = true,
  ttlMs = 60000
}: UseCheckoutPrefillArgs): UseCheckoutPrefillResult => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [status, setStatus] = useState<PrefillStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const addresses = useAddressStore((state) => state.addresses);
  const selectedAddressId = useAddressStore((state) => state.selectedAddressId);
  const isModalOpen = useAddressStore((state) => state.isModalOpen);
  const openModal = useAddressStore((state) => state.openModal);
  const closeModal = useAddressStore((state) => state.closeModal);
  const loadAddresses = useAddressStore((state) => state.loadAddresses);
  const addAddress = useAddressStore((state) => state.addAddress);
  const selectAddress = useAddressStore((state) => state.selectAddress);
  const resetAddresses = useAddressStore((state) => state.reset);

  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const createdDefaultRef = useRef<Set<string>>(new Set());

  const applyCache = useCallback((entry: PrefillCacheEntry) => {
    setContacts(entry.contacts);
    useAddressStore.setState({
      addresses: entry.addressesSnapshot,
      selectedAddressId: entry.selectedAddressId
    });
    setStatus('success');
    setError(null);
  }, []);

  useEffect(() => {
    if (pathname !== '/checkout') {
      return;
    }

    if (!user) {
      resetAddresses();
      setContacts([]);
      setStatus('idle');
      return;
    }

    if (!token) {
      setContacts([]);
      setStatus('idle');
      return;
    }

    const cached = cache.get(user.id);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      applyCache(cached);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setStatus('loading');
    setError(null);
    if (!keepPreviousData) {
      setContacts([]);
    }

    const loadPrefill = async () => {
      try {
        const [contactsResponse] = await Promise.all([
          contactsApi.listByUser(user.id, controller.signal),
          loadAddresses(user.id, controller.signal)
        ]);

        if (controller.signal.aborted || requestIdRef.current !== requestId) return;

        setContacts(contactsResponse);

        const currentState = useAddressStore.getState();
        if (user.address && currentState.addresses.length === 0 && !createdDefaultRef.current.has(user.id)) {
          createdDefaultRef.current.add(user.id);
          const created = await addAddress({
            userId: user.id,
            addressText: user.address,
            coords: null
          });
          await selectAddress(user.id, created.id);
        }

        const snapshot = useAddressStore.getState();
        cache.set(user.id, {
          timestamp: Date.now(),
          contacts: contactsResponse,
          addressesSnapshot: snapshot.addresses,
          selectedAddressId: snapshot.selectedAddressId
        });
        setStatus('success');
      } catch (err: unknown) {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        if ((err as { name?: string })?.name === 'AbortError') return;
        if ((err as { status?: number })?.status === 401) {
          setContacts([]);
          setStatus('error');
          return;
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить данные.');
        setStatus('error');
      }
    };

    void loadPrefill();

    return () => {
      controller.abort();
    };
  }, [
    addAddress,
    applyCache,
    keepPreviousData,
    loadAddresses,
    pathname,
    resetAddresses,
    selectAddress,
    token,
    ttlMs,
    user
  ]);

  return {
    contacts,
    setContacts,
    addresses,
    selectedAddressId,
    isModalOpen,
    openModal,
    closeModal,
    status,
    error
  };
};

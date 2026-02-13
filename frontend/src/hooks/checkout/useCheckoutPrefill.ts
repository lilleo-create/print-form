// frontend/src/hooks/checkout/useCheckoutPrefill.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { contactsApi } from '../../shared/api/contactsApi';
import type { Address, Contact, User } from '../../shared/types';
import { useAddressStore } from '../../app/store/addressStore';

export type PrefillStatus = 'idle' | 'loading' | 'success' | 'error';

type UseCheckoutPrefillArgs = {
  user: User | null;
  keepPreviousData?: boolean;
  ttlMs?: number;
};

type PrefillCacheEntry = {
  timestamp: number;
  contacts: Contact[];
  addresses: Address[];
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
  keepPreviousData = true,
  ttlMs = 60_000
}: UseCheckoutPrefillArgs): UseCheckoutPrefillResult => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [status, setStatus] = useState<PrefillStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const addresses = useAddressStore((s) => s.addresses);
  const selectedAddressId = useAddressStore((s) => s.selectedAddressId);
  const isModalOpen = useAddressStore((s) => s.isModalOpen);
  const openModal = useAddressStore((s) => s.openModal);
  const closeModal = useAddressStore((s) => s.closeModal);

  const loadAddresses = useAddressStore((s) => s.loadAddresses);
  const addAddress = useAddressStore((s) => s.addAddress);
  const selectAddress = useAddressStore((s) => s.selectAddress);
  const resetAddresses = useAddressStore((s) => s.reset);

  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const createdDefaultRef = useRef<Set<string>>(new Set());

  const applyCache = useCallback((entry: PrefillCacheEntry) => {
    setContacts(entry.contacts);
    useAddressStore.setState({
      addresses: entry.addresses,
      selectedAddressId: entry.selectedAddressId
    });
    setStatus('success');
    setError(null);
  }, []);

  useEffect(() => {
    if (!user) {
      controllerRef.current?.abort();
      resetAddresses();
      setContacts([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const cacheKey = `checkout:${user.id}`;
    const cached = cache.get(cacheKey);
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
    if (!keepPreviousData) setContacts([]);

    const guard = () => controller.signal.aborted || requestIdRef.current !== requestId;

    (async () => {
      try {
        const [contactsResponse, loadedAddresses] = await Promise.all([
          contactsApi.listByUser(user.id, controller.signal),
          loadAddresses(user.id, controller.signal)
        ]);

        if (guard()) return;

        setContacts(contactsResponse);

        // Если адресов нет, но в профиле есть user.address -> создаём один раз
        if (
          user.address &&
          loadedAddresses.length === 0 &&
          !createdDefaultRef.current.has(user.id)
        ) {
          createdDefaultRef.current.add(user.id);

          if (guard()) return;

          const created = await addAddress(
            { userId: user.id, addressText: user.address, coords: null },
            controller.signal
          );

          if (guard()) return;

          await selectAddress(user.id, created.id, controller.signal);
        }

        if (guard()) return;

        const snapshot = useAddressStore.getState();

        cache.set(cacheKey, {
          timestamp: Date.now(),
          contacts: contactsResponse,
          addresses: snapshot.addresses,
          selectedAddressId: snapshot.selectedAddressId
        });

        setStatus('success');
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (guard()) return;

        if ((err as { status?: number })?.status === 401) {
          // Сессии нет/умерла
          setContacts([]);
          resetAddresses();
          setStatus('error');
          setError('Unauthorized');
          return;
        }

        setError(err instanceof Error ? err.message : 'Не удалось загрузить данные.');
        setStatus('error');
      }
    })();

    return () => controller.abort();
  }, [user?.id, ttlMs, keepPreviousData, applyCache, loadAddresses, addAddress, selectAddress, resetAddresses]);

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

import { useEffect, useMemo, useState } from 'react';
import { loadFromStorage, removeFromStorage, saveToStorage } from '../shared/lib/storage';

type PersistedEnvelope<T> = {
  version: number;
  updatedAt: number;
  data: T;
};

interface UsePersistedFormOptions<T> {
  storageKey: string;
  data: T | null;
  enabled?: boolean;
  version?: number;
  debounceMs?: number;
}

export const usePersistedForm = <T>({
  storageKey,
  data,
  enabled = true,
  version = 1,
  debounceMs = 300
}: UsePersistedFormOptions<T>) => {
  const [hydratedDraft, setHydratedDraft] = useState<PersistedEnvelope<T> | null>(() =>
    enabled
      ? loadFromStorage<PersistedEnvelope<T> | null>(storageKey, null)
      : null
  );

  useEffect(() => {
    if (!enabled) {
      setHydratedDraft(null);
      return;
    }

    const loaded = loadFromStorage<PersistedEnvelope<T> | null>(storageKey, null);
    if (!loaded || loaded.version !== version) {
      setHydratedDraft(null);
      if (loaded && loaded.version !== version) {
        removeFromStorage(storageKey);
      }
      return;
    }

    setHydratedDraft(loaded);
  }, [enabled, storageKey, version]);

  const clearDraft = () => {
    removeFromStorage(storageKey);
    setHydratedDraft(null);
  };

  useEffect(() => {
    if (!enabled || data === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const envelope: PersistedEnvelope<T> = {
        version,
        updatedAt: Date.now(),
        data
      };
      saveToStorage(storageKey, envelope);
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, data, storageKey, version, debounceMs]);

  return useMemo(
    () => ({
      hydratedDraft,
      clearDraft,
      hasDraft: Boolean(hydratedDraft?.data)
    }),
    [hydratedDraft]
  );
};

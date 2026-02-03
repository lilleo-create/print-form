import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api';

export const useFilters = () => {
  const [filters, setFilters] = useState({ categories: [] as string[], materials: [] as string[], sizes: [] as string[] });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Share a single request across mounts to avoid duplicate fetches in StrictMode.
    const entry = getFiltersRequest();
    entry.subscribers += 1;
    entry.promise
      .then((data) => {
        if (!isMountedRef.current) return;
        setFilters(data);
      })
      .catch((error) => {
        if (!isMountedRef.current) return;
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setFilters({ categories: [], materials: [], sizes: [] });
      });

    return () => {
      isMountedRef.current = false;
      releaseFiltersRequest();
    };
  }, []);

  return filters;
};

type FiltersEntry = {
  controller: AbortController;
  promise: Promise<{ categories: string[]; materials: string[]; sizes: string[] }>;
  subscribers: number;
  abortTimeout?: ReturnType<typeof setTimeout>;
};

let filtersRequest: FiltersEntry | null = null;

const getFiltersRequest = () => {
  if (filtersRequest) {
    if (filtersRequest.abortTimeout) {
      clearTimeout(filtersRequest.abortTimeout);
      filtersRequest.abortTimeout = undefined;
    }
    return filtersRequest;
  }
  const controller = new AbortController();
  const promise = api.getFilters({ signal: controller.signal }).then((response) => response.data);
  filtersRequest = { controller, promise, subscribers: 0 };
  promise.finally(() => {
    if (filtersRequest?.promise === promise) {
      filtersRequest = null;
    }
  });
  return filtersRequest;
};

const releaseFiltersRequest = () => {
  if (!filtersRequest) return;
  filtersRequest.subscribers -= 1;
  if (filtersRequest.subscribers <= 0) {
    // Delay abort slightly so StrictMode remounts can reuse the same request without spam.
    filtersRequest.abortTimeout = setTimeout(() => {
      filtersRequest?.controller.abort();
      filtersRequest = null;
    }, 0);
  }
};

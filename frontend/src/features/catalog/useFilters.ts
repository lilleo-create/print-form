import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api';

export const useFilters = () => {
  const [filters, setFilters] = useState({ categories: [] as string[], materials: [] as string[], sizes: [] as string[] });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();
    api
      .getFilters({ signal: controller.signal })
      .then((response) => {
        if (!isMountedRef.current) return;
        setFilters(response.data);
      })
      .catch((error) => {
        if (!isMountedRef.current) return;
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        if ((error as { status?: number })?.status === 429) {
          return;
        }
        setFilters({ categories: [], materials: [], sizes: [] });
      });

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, []);

  return filters;
};

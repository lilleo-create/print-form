import { useEffect, useState } from 'react';
import { api } from '../../shared/api';

export const useFilters = () => {
  const [filters, setFilters] = useState({
    categories: [] as string[],
    materials: [] as string[],
    sizes: [] as string[],
    colors: [] as string[]
  });

  useEffect(() => {
    let isMounted = true;
    api
      .getFilters()
      .then((response) => {
        if (isMounted) {
          setFilters(response.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFilters({ categories: [], materials: [], sizes: [], colors: [] });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return filters;
};

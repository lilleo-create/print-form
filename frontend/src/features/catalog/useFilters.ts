import { useEffect, useState } from 'react';
import { api } from '../../shared/api';

export const useFilters = () => {
  const [filters, setFilters] = useState({ categories: [], materials: [], sizes: [] } as {
    categories: string[];
    materials: string[];
    sizes: string[];
  });

  useEffect(() => {
    let active = true;
    api.getFilters().then((response) => {
      if (active) {
        setFilters(response.data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return filters;
};

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api';
import { ReturnRequest } from '../../../shared/types';

export const useMyReturns = (activeTab: string) => {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReturns = useCallback(() => {
    setIsLoading(true);
    setError(null);
    return api.returns
      .listMy()
      .then((response) => {
        setReturns(response.data ?? []);
      })
      .catch(() => {
        setReturns([]);
        setError('Не удалось загрузить возвраты.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'returns') return;
    loadReturns();
  }, [activeTab, loadReturns]);

  return { returns, isLoading, error, reload: loadReturns };
};

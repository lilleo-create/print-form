import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { SellerContextResponse } from '../../shared/types';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';
type AuthStatus = 'loading' | 'unauthorized' | 'authorized';

type SellerContextError = {
  status?: number;
  code?: string;
  message: string;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getErrorCode = (payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  if ('code' in payload && typeof payload.code === 'string') {
    return payload.code;
  }
  if ('error' in payload && typeof payload.error === 'object' && payload.error !== null) {
    const nested = payload.error as { code?: unknown };
    if (typeof nested.code === 'string') {
      return nested.code;
    }
  }
  return undefined;
};

const parseSellerContextError = (error: unknown): SellerContextError => {
  const message = getErrorMessage(error);
  const status = (error as { status?: number }).status;
  const payload = (error as { payload?: unknown }).payload;
  return {
    status,
    code: getErrorCode(payload),
    message
  };
};

export const useSellerContext = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [context, setContext] = useState<SellerContextResponse | null>(null);
  const [error, setError] = useState<SellerContextError | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setContext(null);

    try {
      await api.me();
      setAuthStatus('authorized');
    } catch {
      setAuthStatus('unauthorized');
      setStatus('idle');
      return;
    }

    try {
      const response = await api.getSellerContext();
      setContext(response.data);
      setStatus('success');
    } catch (errorResponse) {
      setContext(null);
      setStatus('error');
      setError(parseSellerContextError(errorResponse));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    authStatus,
    status,
    context,
    error,
    reload
  };
};

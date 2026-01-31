import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { SellerProfile } from '../types';

type AuthStatus = 'loading' | 'unauthorized' | 'authorized';
type SellerStatus = 'unknown' | 'not_seller' | 'seller';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isNotSellerError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('forbidden') || message.includes('403') || message.includes('not found') || message.includes('404');
};

export const useSellerGuard = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>('unknown');
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setAuthStatus('loading');
    setSellerStatus('unknown');
    setError(null);

    try {
      await api.me();
      setAuthStatus('authorized');
    } catch {
      setAuthStatus('unauthorized');
      setSellerStatus('unknown');
      setSellerProfile(null);
      return;
    }

    try {
      const response = await api.getSellerProfile();
      const profile = response.data.profile ?? null;
      setSellerProfile(profile);
      setSellerStatus(profile ? 'seller' : 'not_seller');
    } catch (errorResponse) {
      if (isNotSellerError(errorResponse)) {
        setSellerProfile(null);
        setSellerStatus('not_seller');
        return;
      }
      setSellerProfile(null);
      setSellerStatus('unknown');
      setError(getErrorMessage(errorResponse));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    authStatus,
    sellerStatus,
    sellerProfile,
    error,
    reload
  };
};

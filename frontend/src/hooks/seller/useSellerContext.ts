import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../app/store/authStore';
import { api } from '../../shared/api';
import { normalizeRole } from '../../shared/lib/authAccess';

export type SellerAuthStatus = 'loading' | 'authorized' | 'unauthorized';

export type SellerProfile = {
  id: string;
  userId: string;
  sellerType?: string | null;
  storeName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  city?: string | null;
  representativeName?: string | null;
  legalName?: string | null;
  inn?: string | null;
  ogrn?: string | null;
};

export type SellerContextError = {
  code?: string;
  status?: number;
  message: string;
} | null;

export type SellerContext = {
  authStatus: SellerAuthStatus;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: SellerContextError;
  reload: () => void;
  context: {
    profile: SellerProfile | null;
  } | null;
};

export const useSellerContext = (): SellerContext => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthInitialized = useAuthStore((s) => s.isAuthInitialized);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<SellerContextError>(null);
  const [context, setContext] = useState<{ profile: SellerProfile | null } | null>(null);

  const hasSellerAccess =
    isAuthenticated &&
    !!user &&
    (normalizeRole(user.role) === 'seller' ||
      normalizeRole(user.role) === 'admin' ||
      !!user.roles?.isSeller ||
      !!user.capabilities?.canAccessSeller);

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    setError(null);
    try {
      const res = await api.getSellerContext(signal);
      if (signal?.aborted) return;
      setContext({ profile: res.data?.profile ?? null });
      setStatus('success');
    } catch (e) {
      if (signal?.aborted) return;
      const err = e as Error & { status?: number };
      setError({ code: String(err.status ?? ''), status: err.status, message: err.message });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!isAuthInitialized || !hasSellerAccess) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isAuthInitialized, hasSellerAccess, load]);

  const authStatus: SellerAuthStatus = !isAuthInitialized
    ? 'loading'
    : !isAuthenticated || !user || !hasSellerAccess
    ? 'unauthorized'
    : 'authorized';

  return {
    authStatus,
    status,
    error,
    reload: () => void load(),
    context,
  };
};

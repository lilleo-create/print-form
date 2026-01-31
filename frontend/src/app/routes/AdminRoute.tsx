import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAuthStore } from '../store/authStore';
import { Role, User } from '../../shared/types';

interface AdminRouteProps {
  children: JSX.Element;
}

type GuardStatus = 'loading' | 'authorized' | 'unauthorized' | 'forbidden';

const normalizeRole = (role?: string): Role => {
  const lower = (role ?? '').toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'seller') return 'seller';
  return 'buyer';
};

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const [status, setStatus] = useState<GuardStatus>('loading');
  const setUser = useAuthStore((state) => state.setUser);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((response) => {
        if (!active) return;
        const role = normalizeRole(response.data.role);
        const user: User = {
          ...response.data,
          role,
          phone: response.data.phone ?? null,
          address: response.data.address ?? null
        };
        setUser(user);
        if (role !== 'admin') {
          setStatus('forbidden');
          return;
        }
        setStatus('authorized');
      })
      .catch(() => {
        if (!active) return;
        setStatus('unauthorized');
      });

    return () => {
      active = false;
    };
  }, [setUser]);

  if (status === 'loading') {
    return <p className="container">Загрузка...</p>;
  }

  if (status === 'unauthorized') {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirectTo=${redirectTo}`} replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/account" replace />;
  }

  return children;
};

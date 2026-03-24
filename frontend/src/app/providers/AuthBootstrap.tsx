import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export const AuthBootstrap = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }

    void initializeAuth();
  }, [initializeAuth]);

  return null;
};

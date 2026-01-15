import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Role } from '../../shared/types';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: Role;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/account" replace />;
  }

  return children;
};

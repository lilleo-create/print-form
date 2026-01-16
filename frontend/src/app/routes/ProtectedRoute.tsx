import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Role } from '../../shared/types';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: Role;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirectTo=${redirectTo}`} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/account" replace />;
  }

  return children;
};

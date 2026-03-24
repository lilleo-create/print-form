import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Role } from '../../shared/types';
import { hasRequiredRole } from '../../shared/lib/authAccess';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: Role | Role[];
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const user = useAuthStore((state) => state.user);
  const isAuthInitialized = useAuthStore((state) => state.isAuthInitialized);
  const isRestoringSession = useAuthStore((state) => state.isRestoringSession);
  const location = useLocation();

  if (!isAuthInitialized || isRestoringSession) {
    return <p className="container">Загрузка...</p>;
  }

  if (!user) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirectTo=${redirectTo}`} replace />;
  }

  if (requiredRole) {
    if (!hasRequiredRole(user, requiredRole)) {
      return <Navigate to="/account" replace />;
    }
  }

  return children;
};

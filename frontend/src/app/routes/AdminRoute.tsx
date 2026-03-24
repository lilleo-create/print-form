import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { canAccessAdmin } from '../../shared/lib/authAccess';

interface AdminRouteProps {
  children: JSX.Element;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
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

  if (!canAccessAdmin(user)) {
    return <Navigate to="/account" replace />;
  }

  return children;
};

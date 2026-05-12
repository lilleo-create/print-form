import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { setAccessToken } from '../shared/lib/storage';
import { scheduleProactiveRefresh } from '../shared/api/client';
import { api } from '../shared/api';

// Backend redirects here after successful OAuth:
// /auth/oauth-callback?token=<access_token>  (if backend sends token in URL)
// /auth/oauth-callback?error=<reason>         (on failure)
// If backend only sets an httpOnly cookie (no token in URL), we call /auth/me directly.
export const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const error = searchParams.get('error');
    if (error) {
      navigate(`/auth/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    const token = searchParams.get('token');

    (async () => {
      try {
        if (token) {
          setAccessToken(token);
          scheduleProactiveRefresh(token);
        }

        // Fetch the authenticated user profile.
        // If backend sent an httpOnly cookie instead of a token in URL,
        // this request will use the cookie via credentials: 'include'.
        const res = await api.me();
        const raw = res.data;
        if (raw) {
          setUser({ ...raw, name: raw.name ?? '' });
        }

        const redirectTo = searchParams.get('redirectTo') ?? '/account';
        navigate(redirectTo, { replace: true });
      } catch {
        navigate('/auth/login?error=oauth_failed', { replace: true });
      }
    })();
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--muted)' }}>Выполняется вход…</p>
    </div>
  );
};

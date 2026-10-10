import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { setAccessToken } from '../shared/lib/storage';
import { scheduleProactiveRefresh } from '../shared/api/client';
import { api } from '../shared/api';
import { authApi, type OtpRequestResponse } from '../shared/api/authApi';
import { OtpStep } from './OtpStep';

export const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const didRun = useRef(false);
  const onboarding = searchParams.get('onboarding') === '1';
  const onboardingToken = searchParams.get('token');
  const fullNameRequired = searchParams.get('fullNameRequired') === '1';
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpRequest, setOtpRequest] = useState<OtpRequestResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (onboarding || didRun.current) return;
    didRun.current = true;
    const errorCode = searchParams.get('error');
    if (errorCode) return navigate(`/auth/login?error=${encodeURIComponent(errorCode)}`, { replace: true });
    const token = searchParams.get('token');
    void (async () => {
      try {
        if (token) { setAccessToken(token); scheduleProactiveRefresh(token); }
        const res = await api.me();
        if (res.data) setUser({ ...res.data, name: res.data.name ?? '' });
        navigate(searchParams.get('redirectTo') ?? '/account', { replace: true });
      } catch { navigate('/auth/login?error=oauth_failed', { replace: true }); }
    })();
  }, [navigate, onboarding, searchParams, setUser]);

  if (onboarding && onboardingToken) {
    if (otpRequest) return <OtpStep purpose="oauth_phone_binding" tempToken={onboardingToken} initialPhone={phone} initialRequest={otpRequest}
      title="Подтверждение номера" onRequestOtp={async (payload, token) => ({ otpRequest: await authApi.requestOtp({ ...payload, purpose: 'oauth_phone_binding' }, token) })}
      onCheckOtpStatus={authApi.checkOtpStatus}
      onVerifyOtp={async ({ phone: verifiedPhone, requestId }, token) => {
        const session = await authApi.verifyOtp({ phone: verifiedPhone, requestId, purpose: 'oauth_phone_binding', fullName: fullName || undefined }, token);
        if (!session) throw new Error('OAuth onboarding verification failed');
        setAccessToken(session.token); scheduleProactiveRefresh(session.token); setUser(session.user);
      }} onSuccess={() => navigate('/account', { replace: true })} setMessage={() => undefined} setError={setError}
      onBack={() => setOtpRequest(null)} />;
    return <section style={{ maxWidth: 440, margin: '48px auto' }}>
      <h1>Укажите номер телефона</h1>
      <p>Подтвердите номер бесплатным звонком, чтобы завершить регистрацию.</p>
      {fullNameRequired && <label>ФИО<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" /></label>}
      <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+7 900 000-00-00" /></label>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={async () => {
        if (!phone.trim() || (fullNameRequired && fullName.trim().split(/\s+/).filter(Boolean).length < 2)) { setError(fullNameRequired ? 'Введите ФИО и номер телефона.' : 'Введите номер телефона.'); return; }
        try { const request = await authApi.requestOtp({ phone, purpose: 'oauth_phone_binding' }, onboardingToken); if (!request) throw new Error(); setOtpRequest(request); } catch { setError('Не удалось начать подтверждение номера.'); }
      }}>Продолжить</button>
    </section>;
  }
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><p>Выполняется вход…</p></div>;
};

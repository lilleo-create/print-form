import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import styles from './AuthPage.module.css';
import { OtpStep } from './OtpStep';

type Purpose = 'login' | 'register' | 'seller_verify';

const normalizePhone = (v: string) => (v ?? '').replace(/\D/g, '');

// Маска: +7 (___) ___-__-__
const formatRuPhone = (value: string) => {
  const digits = normalizePhone(value);

  let d = digits;
  if (d.startsWith('7')) d = d.slice(1);
  if (d.startsWith('8')) d = d.slice(1);

  d = d.slice(0, 10);

  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);

  let out = '+7';
  if (d.length > 0) out += ` (${p1}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${p2}`;
  if (d.length > 6) out += `-${p3}`;
  if (d.length > 8) out += `-${p4}`;

  return out;
};

// На бэк: 7XXXXXXXXXX (11)
const toE164Ru = (value: string) => {
  const digits = normalizePhone(value);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const ten = last10.slice(0, 10);
  return ('7' + ten).slice(0, 11);
};

const loginSchema = z.object({
  email: z.string().email('Введите email'),
  password: z.string().min(6, 'Минимум 6 символов')
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  address: z.string().min(5, 'Введите адрес')
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const getRedirectPath = ({
  role,
  redirectTo,
  sellerOnboarded
}: {
  role?: string;
  redirectTo?: string | null;
  sellerOnboarded?: boolean;
}) => {
  if (redirectTo) {
    return redirectTo;
  }
  const normalizedRole = (role ?? '').toLowerCase();
  if (normalizedRole === 'seller') {
    return sellerOnboarded ? '/seller' : '/seller/onboarding';
  }
  if (normalizedRole === 'admin') {
    return '/admin';
  }
  return '/account';
};

export const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname.includes('/register');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // OTP state (минимально)
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpPurpose, setOtpPurpose] = useState<Purpose>(isRegister ? 'register' : 'login');
  const [otpPhone, setOtpPhone] = useState<string>('');

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const setUser = useAuthStore((s) => s.setUser);

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('redirectTo');
  }, [location.search]);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const resolveRedirectPath = async (role?: string) => {
    if (redirectTo) {
      return redirectTo;
    }
    const normalizedRole = (role ?? '').toLowerCase();
    if (normalizedRole !== 'seller') {
      return getRedirectPath({ role, redirectTo });
    }
    try {
      const response = await api.getSellerProfile();
      return getRedirectPath({
        role,
        redirectTo,
        sellerOnboarded: Boolean(response.data?.profile)
      });
    } catch {
      return getRedirectPath({ role, redirectTo, sellerOnboarded: false });
    }
  };

  const handleRedirect = async () => {
    const currentUser = useAuthStore.getState().user;
    const path = await resolveRedirectPath(currentUser?.role);
    queueMicrotask(() => navigate(path, { replace: true }));
  };

  const resetOtp = () => {
    setOtpRequired(false);
    setOtpToken(null);
    setOtpPhone('');
    setOtpPurpose(isRegister ? 'register' : 'login');
  };

  const resetMessages = () => {
    setError('');
    setMessage('');
  };

  useEffect(() => {
    resetOtp();
    resetMessages();
    if (!isRegister) setPrivacyAccepted(false);
  }, [isRegister]);

  const onLogin = async (values: LoginValues) => {
    resetMessages();
    resetOtp();

    try {
      const result = await login(values.email, values.password);

      if (result.requiresOtp) {
        setOtpPurpose('login');
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpPhone(result.user?.phone ?? '');
        setMessage('Подтвердите номер телефона для входа.');
        return;
      }

      const nextUser = result.user;
      if (nextUser) {
        setUser(nextUser);
      }
      const path = await resolveRedirectPath(nextUser?.role);
      queueMicrotask(() => navigate(path, { replace: true }));
    } catch {
      setError('Неверный email или пароль.');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    resetMessages();
    resetOtp();

    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: toE164Ru(values.phone),
        address: values.address,
        privacyAccepted
      });

      if (result.requiresOtp) {
        setOtpPurpose('register');
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpPhone(values.phone);
        setMessage('Подтвердите номер телефона для завершения регистрации.');
        return;
      }

      const nextUser = result.user;
      if (nextUser) {
        setUser(nextUser);
      }
      const path = await resolveRedirectPath(nextUser?.role);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[auth] register ok', nextUser, 'redirect', path);
      }
      queueMicrotask(() => navigate(path, { replace: true }));
    } catch {
      setError('Не удалось зарегистрироваться.');
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <h1>{isRegister ? 'Регистрация' : 'Вход'}</h1>

        {otpRequired ? (
          <OtpStep
            purpose={otpPurpose}
            tempToken={otpToken}
            initialPhone={otpPhone}
            privacyAccepted={privacyAccepted}
            onPrivacyAcceptedChange={setPrivacyAccepted}
            onRequestOtp={requestOtp}
            onVerifyOtp={verifyOtp}
            onSuccess={() => {
              void handleRedirect();
            }}
            setMessage={setMessage}
            setError={setError}
          />
        ) : isRegister ? (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className={styles.form}>
            <input placeholder="Имя" {...registerForm.register('name')} />

            <input
              placeholder="+7 (___) ___-__-__"
              value={registerForm.watch('phone') ?? ''}
              inputMode="tel"
              onFocus={() => {
                const v = registerForm.getValues('phone') ?? '';
                if (!v) registerForm.setValue('phone', '+7', { shouldValidate: true });
              }}
              onChange={(e) =>
                registerForm.setValue('phone', formatRuPhone(e.target.value), {
                  shouldValidate: true,
                  shouldDirty: true
                })
              }
            />

            <input placeholder="Адрес" {...registerForm.register('address')} />
            <input placeholder="Email" {...registerForm.register('email')} />
            <input type="password" placeholder="Пароль" {...registerForm.register('password')} />

            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
              />
              <span>
                Я соглашаюсь на{' '}
                <Link to="/privacy-policy" className={styles.policyLink}>
                  обработку персональных данных
                </Link>
              </span>
            </label>

            <Button type="submit" disabled={!privacyAccepted}>
              Создать аккаунт
            </Button>
          </form>
        ) : (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className={styles.form}>
            <input placeholder="Email" {...loginForm.register('email')} />
            <input type="password" placeholder="Пароль" {...loginForm.register('password')} />
            <Button type="submit">Войти</Button>

            <Link className={styles.forgot} to="/auth/forgot-password">
              Забыли пароль?
            </Link>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        {!otpRequired && (
          <Link className={styles.switch} to={isRegister ? '/auth/login' : '/auth/register'}>
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </Link>
        )}
      </div>
    </section>
  );
};

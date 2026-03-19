import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { formatRuPhoneInput, normalizePhone, toE164Ru } from '../shared/lib/validation';
import styles from './AuthPage.module.css';
import { OtpStep } from './OtpStep';
import loginHero from '../shared/assets/login-hero.svg';

type Purpose = 'buyer_register_phone' | 'buyer_change_phone' | 'buyer_sensitive_action' | 'seller_connect_phone' | 'seller_change_payout_details' | 'seller_payout_settings_verify';

const isValidLoginPhone = (value: string) => {
  const digits = normalizePhone(value);
  const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  return normalized.length === 11 && normalized.startsWith('7');
};

const loginSchema = z.object({
  phone: z.string().refine((value) => isValidLoginPhone(value), 'Введите телефон в формате +7 (9XX) XXX-XX-XX'),
  password: z.string().min(6, 'Минимум 6 символов')
});

const fioRegex = /^[A-Za-zА-Яа-яЁё\-\s]+$/;

const passwordHelpText = 'Минимум 8 символов, латиница, 1 заглавная буква и 1 цифра';

const isStrongPassword = (value: string) => /^(?=.*[A-Z])(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(value);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Введите никнейм'),
  fullName: z.string().trim().min(3, 'Введите ФИО').max(120, 'Слишком длинное ФИО').refine((value) => fioRegex.test(value), 'Допустимы только буквы, пробел и дефис').refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, 'Введите минимум имя и фамилию'),
  phone: z.string().min(5, 'Введите телефон'),
  email: z.string().email('Введите email'),
  password: z.string().trim().refine((value) => isStrongPassword(value), passwordHelpText),
  confirmPassword: z.string().trim().min(1, 'Повторите пароль')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword']
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

  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpPurpose, setOtpPurpose] = useState<Purpose>('buyer_register_phone');
  const [otpPhone, setOtpPhone] = useState<string>('');
  const [otpUiState, setOtpUiState] = useState<'idle' | 'requesting' | 'call_to_auth' | 'error'>('idle');

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const checkOtpStatus = useAuthStore((s) => s.checkOtpStatus);
  const setUser = useAuthStore((s) => s.setUser);

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('redirectTo');
  }, [location.search]);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { phone: '', password: '' } });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: 'onBlur', reValidateMode: 'onChange' });

  const resolveRedirectPath = async (role?: string) => {
    if (redirectTo) {
      return redirectTo;
    }
    const normalizedRole = (role ?? '').toLowerCase();
    if (normalizedRole !== 'seller') {
      return getRedirectPath({ role, redirectTo });
    }
    try {
      const response = await api.getSellerContext();
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
    setOtpPurpose('buyer_register_phone');
    setOtpUiState('idle');
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

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setMessage(state.message);
    }
  }, [location.state]);

  const onLogin = async (values: LoginValues) => {
    resetMessages();
    resetOtp();

    try {
      const normalizedPhone = toE164Ru(values.phone);
      const result = await login(normalizedPhone, values.password);

      if (result.requiresOtp) {
        setOtpPurpose('buyer_register_phone');
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpPhone(result.user?.phone ?? normalizedPhone);
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
      setError('Неверный номер телефона или пароль.');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    resetMessages();
    resetOtp();

    try {
      const result = await register({
        name: values.name.trim(),
        fullName: values.fullName.trim().replace(/\s+/g, ' '),
        email: values.email,
        password: values.password,
        phone: toE164Ru(values.phone),
        privacyAccepted
      });

      if (result.requiresOtp) {
        setOtpPurpose('buyer_register_phone');
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
        console.log('[auth] register ok', nextUser, 'redirect', path);
      }
      queueMicrotask(() => navigate(path, { replace: true }));
    } catch {
      setError('Не удалось зарегистрироваться.');
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <div className={styles.card}>
            {otpUiState !== 'call_to_auth' && (
              <div className={styles.header}>
                <p className={styles.eyebrow}>{isRegister ? 'Создайте аккаунт' : 'Добро пожаловать'}</p>
                <h1>{isRegister ? 'Регистрация' : 'Вход'}</h1>
                <p className={styles.subtitle}>
                  {isRegister ? 'Начните продавать и покупать 3D печать за пару минут.' : 'Войдите, чтобы продолжить работу с заказами.'}
                </p>
              </div>
            )}

            {otpRequired ? (
              <OtpStep
                purpose={otpPurpose}
                tempToken={otpToken}
                initialPhone={otpPhone}
                onRequestOtp={requestOtp}
                onCheckOtpStatus={checkOtpStatus}
                onVerifyOtp={verifyOtp}
                onSuccess={() => {
                  void handleRedirect();
                }}
                setMessage={setMessage}
                setError={setError}
                onUiStateChange={setOtpUiState}
              />
            ) : isRegister ? (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className={styles.form}>
                <input placeholder="Никнейм" {...registerForm.register('name')} />
                <input placeholder="ФИО" {...registerForm.register('fullName')} />

                <input
                  placeholder="+7 (___) ___-__-__"
                  value={registerForm.watch('phone') ?? ''}
                  inputMode="tel"
                  autoComplete="tel"
                  onFocus={() => {
                    const v = registerForm.getValues('phone') ?? '';
                    if (!v) registerForm.setValue('phone', '+7', { shouldValidate: true });
                  }}
                  onChange={(e) =>
                    registerForm.setValue('phone', formatRuPhoneInput(e.target.value), {
                      shouldValidate: true,
                      shouldDirty: true
                    })
                  }
                />

                <input placeholder="Email" {...registerForm.register('email')} />
                <input type="password" placeholder="Пароль" autoComplete="new-password" {...registerForm.register('password')} />
                <span className={styles.helperText}>{passwordHelpText}</span>
                {registerForm.formState.errors.password && registerForm.formState.touchedFields.password && (
                  <span>{registerForm.formState.errors.password.message}</span>
                )}
                <input type="password" placeholder="Повторите пароль" autoComplete="new-password" {...registerForm.register('confirmPassword')} />
                {registerForm.formState.errors.confirmPassword && (
                  <span>{registerForm.formState.errors.confirmPassword.message}</span>
                )}

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
                <input
                  placeholder="+7 (___) ___-__-__"
                  inputMode="tel"
                  autoComplete="tel"
                  value={loginForm.watch('phone') ?? ''}
                  onFocus={() => {
                    const currentValue = loginForm.getValues('phone') ?? '';
                    if (!currentValue) loginForm.setValue('phone', '+7', { shouldValidate: true });
                  }}
                  onChange={(event) => loginForm.setValue('phone', formatRuPhoneInput(event.target.value), { shouldDirty: true, shouldValidate: true })}
                />
                {loginForm.formState.errors.phone && <span>{loginForm.formState.errors.phone.message}</span>}
                <input type="password" placeholder="Пароль" autoComplete="current-password" {...loginForm.register('password')} />
                {loginForm.formState.errors.password && <span>{loginForm.formState.errors.password.message}</span>}
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
        </div>
        <div className={styles.hero}>
          <img src={loginHero} alt="3D принтер печатает модель" />
        </div>
      </div>
    </section>
  );
};

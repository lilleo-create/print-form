import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { loadFromStorage, removeFromStorage, saveToStorage } from '../shared/lib/storage';
import { STORAGE_KEYS } from '../shared/constants/storageKeys';
import {
  formatRuPhoneInput,
  normalizePhone,
  toE164Ru
} from '../shared/lib/validation';
import styles from './AuthPage.module.css';
import { Turnstile } from '../shared/ui/Turnstile';
import { OtpStep } from './OtpStep';
import loginHero from '../shared/assets/login-hero.svg';

import type { OtpFlowType, RegistrationPurpose } from '../shared/api/authApi';
import { getOtpPurposeForFlow } from '../shared/api/authApi';
import type { User } from '../shared/types';
import { canAccessAdmin, normalizeRole } from '../shared/lib/authAccess';

const isValidLoginPhone = (value: string) => {
  const digits = normalizePhone(value);
  const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  return normalized.length === 11 && normalized.startsWith('7');
};

const isValidRegisterPhone = (value: string) => {
  const digits = normalizePhone(value);
  const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  return normalized.length === 11 && normalized.startsWith('79');
};

const loginSchema = z.object({
  phone: z
    .string()
    .refine(
      (value) => isValidLoginPhone(value),
      'Введите телефон в формате +7 (9XX) XXX-XX-XX'
    ),
  password: z.string().min(6, 'Минимум 6 символов')
});

const fioRegex = /^[A-Za-zА-Яа-яЁё\-\s]+$/;

const passwordHelpText =
  'Пароль должен содержать минимум 8 символов, заглавную латинскую букву и цифру';

const isStrongPassword = (value: string) =>
  /^(?=.*[A-Z])(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(value);

const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Введите имя'),
    fullName: z
      .string()
      .trim()
      .min(3, 'Введите ФИО')
      .max(120, 'Слишком длинное ФИО')
      .refine(
        (value) => fioRegex.test(value),
        'Допустимы только буквы, пробел и дефис'
      )
      .refine(
        (value) => value.split(/\s+/).filter(Boolean).length >= 2,
        'Введите минимум имя и фамилию'
      ),
    phone: z
      .string()
      .min(1, 'Введите корректный номер телефона')
      .refine(
        (value) => isValidRegisterPhone(value),
        'Введите корректный номер телефона'
      ),
    email: z
      .string()
      .trim()
      .min(1, 'Введите корректный email')
      .email('Введите корректный email'),
    password: z
      .string()
      .superRefine((value, ctx) => {
        if (!value.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Введите пароль'
          });
          return;
        }

        if (value.trim().length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Пароль должен содержать минимум 8 символов'
          });
          return;
        }

        if (!isStrongPassword(value.trim())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: passwordHelpText
          });
        }
      }),
    confirmPassword: z.string().trim().min(1, 'Введите пароль')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword']
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const getRedirectPath = ({
  user,
  redirectTo,
  sellerOnboarded
}: {
  user?: User | null;
  redirectTo?: string | null;
  sellerOnboarded?: boolean;
}) => {
  if (redirectTo) {
    return redirectTo;
  }
  if (canAccessAdmin(user)) {
    return '/admin';
  }
  const normalizedRole = normalizeRole(user?.role);
  if (normalizedRole === 'seller') {
    return sellerOnboarded ? '/seller' : '/seller/onboarding';
  }
  return '/account';
};

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <path d="M1 1l22 22"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname.includes('/register');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [loginCaptchaKey, setLoginCaptchaKey] = useState(0);
  const [registerCaptchaToken, setRegisterCaptchaToken] = useState('');
  const [registerCaptchaKey, setRegisterCaptchaKey] = useState(0);

  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpPurpose, setOtpPurpose] = useState<RegistrationPurpose | null>('buyer_register_phone');
  const [otpPhone, setOtpPhone] = useState<string>('');
  const [otpFlowType, setOtpFlowType] = useState<OtpFlowType>('registration');
  const [otpRequest, setOtpRequest] = useState<{
    requestId: string;
    verificationType: 'call_to_auth';
    callToAuthNumber?: string | null;
    phone?: string;
    status?: string;
    expiresInSec?: number;
  } | null>(null);
  const [otpUiState, setOtpUiState] = useState<
    'idle' | 'requesting' | 'call_to_auth' | 'error'
  >('idle');

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const requestDeviceLoginOtp = useAuthStore((s) => s.requestDeviceLoginOtp);
  const verifyDeviceLoginOtp = useAuthStore((s) => s.verifyDeviceLoginOtp);
  const checkOtpStatus = useAuthStore((s) => s.checkOtpStatus);
  const setUser = useAuthStore((s) => s.setUser);
  const persistedOtp = useAuthStore((s) => s.otp);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthInitialized = useAuthStore((s) => s.isAuthInitialized);

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('redirectTo');
  }, [location.search]);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' }
  });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      fullName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const registerPasswordValue = registerForm.watch('password') ?? '';
  const registerPasswordField = registerForm.register('password');
  const confirmPasswordField = registerForm.register('confirmPassword');
  const registerPasswordError = registerForm.formState.errors.password?.message;
  const shouldShowRegisterPasswordMessage =
    Boolean(registerPasswordError) &&
    (Boolean(registerForm.formState.touchedFields.password) ||
      registerForm.formState.submitCount > 0 ||
      registerPasswordValue.length > 0);

  const confirmPasswordValue = registerForm.watch('confirmPassword') ?? '';
  const shouldShowConfirmPasswordError =
    Boolean(registerForm.formState.errors.confirmPassword) &&
    (Boolean(registerForm.formState.touchedFields.confirmPassword) ||
      registerForm.formState.submitCount > 0 ||
      confirmPasswordValue.length > 0);

  const resolveRedirectPath = async (user?: User | null) => {
    if (redirectTo) {
      return redirectTo;
    }
    const normalizedRole = normalizeRole(user?.role);
    if (normalizedRole !== 'seller') {
      return getRedirectPath({ user, redirectTo });
    }
    try {
      const response = await api.getSellerContext();
      return getRedirectPath({
        user,
        redirectTo,
        sellerOnboarded: Boolean(response.data?.profile)
      });
    } catch {
      return getRedirectPath({ user, redirectTo, sellerOnboarded: false });
    }
  };

  const handleRedirect = async () => {
    const currentUser = useAuthStore.getState().user;
    const path = await resolveRedirectPath(currentUser);
    queueMicrotask(() => navigate(path, { replace: true }));
  };

  const resetOtp = () => {
    setOtpRequired(false);
    setOtpToken(null);
    setOtpPhone('');
    setOtpPurpose('buyer_register_phone');
    setOtpFlowType('registration');
    setOtpRequest(null);
    setOtpUiState('idle');
    removeFromStorage(STORAGE_KEYS.authOtpFlow);
  };

  const resetMessages = () => {
    setError('');
    setMessage('');
  };

  useEffect(() => {
    resetOtp();
    resetMessages();
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowConfirmPassword(false);
    if (!isRegister) setPrivacyAccepted(false);
  }, [isRegister]);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setMessage(state.message);
    }
  }, [location.state]);

  useEffect(() => {
    if (!otpRequired) {
      return;
    }

    saveToStorage(STORAGE_KEYS.authOtpFlow, {
      required: otpRequired,
      tempToken: otpToken,
      phone: otpPhone,
      purpose: otpPurpose,
      flowType: otpFlowType,
      request: otpRequest,
    });
  }, [otpFlowType, otpPhone, otpPurpose, otpRequest, otpRequired, otpToken]);

  useEffect(() => {
    const stored = loadFromStorage<{
      required?: boolean;
      tempToken?: string | null;
      phone?: string;
      purpose?: RegistrationPurpose | null;
      flowType?: OtpFlowType;
      request?: typeof otpRequest;
    } | null>(STORAGE_KEYS.authOtpFlow, null);

    if (stored?.required && stored.tempToken && stored.phone) {
      setOtpRequired(true);
      setOtpToken(stored.tempToken);
      setOtpPhone(stored.phone);
      setOtpPurpose(stored.purpose ?? getOtpPurposeForFlow(stored.flowType ?? 'registration'));
      setOtpFlowType(stored.flowType ?? 'registration');
      setOtpRequest(stored.request ?? null);
      return;
    }

    if (persistedOtp.required && persistedOtp.tempToken && persistedOtp.phone) {
      setOtpRequired(true);
      setOtpToken(persistedOtp.tempToken);
      setOtpPhone(persistedOtp.phone);
      setOtpPurpose(persistedOtp.purpose ?? getOtpPurposeForFlow(persistedOtp.flowType ?? 'registration'));
      setOtpFlowType(persistedOtp.flowType ?? 'registration');
      setOtpRequest(persistedOtp.otpRequest);
    }
  }, [persistedOtp]);

  useEffect(() => {
    if (!isAuthInitialized || !isAuthenticated) {
      return;
    }

    void handleRedirect();
  }, [isAuthInitialized, isAuthenticated]);

  const onLogin = async (values: LoginValues) => {
    resetMessages();
    resetOtp();

    try {
      const normalizedPhone = toE164Ru(values.phone);
      const result = await login(normalizedPhone, values.password, loginCaptchaToken || undefined);

      if ('requiresOtp' in result && result.requiresOtp) {
        const flowType = result.flowType ?? 'registration';
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpPhone(result.phone ?? result.verification?.phone ?? result.user?.phone ?? normalizedPhone);
        setOtpFlowType(flowType);
        setOtpRequest(result.otpRequest ?? null);
        setOtpPurpose(getOtpPurposeForFlow(flowType));
        if (flowType === 'device_login_verification') {
          setMessage('Подтвердите вход с нового устройства звонком.');
        } else {
          setMessage('Подтвердите номер телефона для входа через звонок.');
        }
        return;
      }

      const nextUser = result.user;
      if (nextUser) {
        setUser(nextUser);
      }
      const path = await resolveRedirectPath(nextUser);
      queueMicrotask(() => navigate(path, { replace: true }));
    } catch {
      setError('Неверный номер телефона или пароль.');
      setLoginCaptchaToken('');
      setLoginCaptchaKey((k) => k + 1);
    }
  };

  const onRegister = async (values: RegisterValues) => {
    resetMessages();
    resetOtp();

    try {
      const result = await register({
        name: values.name.trim(),
        fullName: values.fullName.trim().replace(/\s+/g, ' '),
        email: values.email.trim(),
        password: values.password,
        phone: toE164Ru(values.phone),
        privacyAccepted,
        captchaToken: registerCaptchaToken || undefined
      });

      if (result.requiresOtp) {
        setOtpPurpose('buyer_register_phone');
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpPhone(values.phone);
        setOtpRequest(null);
        setMessage('Подтвердите номер телефона звонком, чтобы завершить регистрацию.');
        return;
      }

      const nextUser = result.user;
      if (nextUser) {
        setUser(nextUser);
      }
      const path = await resolveRedirectPath(nextUser);
      if (import.meta.env.DEV) {
        console.log('[auth] register ok', nextUser, 'redirect', path);
      }
      queueMicrotask(() => navigate(path, { replace: true }));
    } catch {
      setError('Не удалось зарегистрироваться.');
      setRegisterCaptchaToken('');
      setRegisterCaptchaKey((k) => k + 1);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.layout}>

        {/* ── Form column ── */}
        <div className={styles.formColumn}>
          <div className={styles.card}>

            {otpUiState !== 'call_to_auth' && (
              <div className={styles.header}>
                <h1 className={styles.heading}>
                  {isRegister ? 'Регистрация' : 'Вход'}
                </h1>
                <p className={styles.subtitle}>
                  {isRegister
                    ? 'Начните покупать и продавать 3D-печать за пару минут.'
                    : 'Войдите, чтобы продолжить работу с заказами.'}
                </p>
              </div>
            )}

            {!otpRequired && (
              <>
                {/* OAuth */}
                <div className={styles.oauthButtons}>
                  <a
                    href={`${import.meta.env.VITE_API_URL}/auth/google?redirectTo=${encodeURIComponent(window.location.origin + '/auth/oauth-callback')}`}
                    className={styles.oauthBtn}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Войти через Google
                  </a>
                  <a
                    href={`${import.meta.env.VITE_API_URL}/auth/yandex?redirectTo=${encodeURIComponent(window.location.origin + '/auth/oauth-callback')}`}
                    className={styles.oauthBtn}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
                      <circle cx="12" cy="12" r="12" fill="#FC3F1D"/>
                      <path d="M13.32 5.6H12.1c-1.76 0-2.69.88-2.69 2.32 0 1.62.7 2.37 2.13 3.34l1.18.8-3.4 5.34H7.5l3.22-5.04c-1.83-1.28-2.87-2.52-2.87-4.38 0-2.28 1.58-3.78 4.23-3.78h2.92V17.4h-1.68V5.6z" fill="#fff"/>
                    </svg>
                    Войти через Яндекс
                  </a>
                </div>

                <div className={styles.divider}><span>или</span></div>
              </>
            )}

            {/* ── OTP / Forms ── */}
            {otpRequired ? (
              <OtpStep
                purpose={otpPurpose}
                tempToken={otpToken}
                initialPhone={otpPhone}
                flowType={otpFlowType}
                initialRequest={otpRequest}
                title={otpFlowType === 'device_login_verification' ? 'Подтвердите вход с нового устройства' : undefined}
                introMessage={otpFlowType === 'device_login_verification' ? 'Ожидаем автоматическое подтверждение входа после звонка.' : undefined}
                onRequestOtp={async (payload, token) => {
                  if (otpFlowType === 'device_login_verification') {
                    const req = await requestDeviceLoginOtp({ phone: payload.phone }, token);
                    setOtpRequest(req);
                    return { otpRequest: req };
                  }
                  const req = await requestOtp(payload, token);
                  setOtpRequest(req);
                  return { otpRequest: req };
                }}
                onCheckOtpStatus={checkOtpStatus}
                onVerifyOtp={otpFlowType === 'device_login_verification' ? verifyDeviceLoginOtp : verifyOtp}
                onSuccess={() => {
                  removeFromStorage(STORAGE_KEYS.authOtpFlow);
                  void handleRedirect();
                }}
                setMessage={setMessage}
                setError={setError}
                onUiStateChange={setOtpUiState}
                onBack={resetOtp}
              />

            ) : isRegister ? (

              /* ── Register form ── */
              <form onSubmit={registerForm.handleSubmit(onRegister)} className={styles.form}>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Никнейм</label>
                  <input placeholder="Как вас называть" {...registerForm.register('name')} />
                  {registerForm.formState.errors.name && (
                    <span className={styles.fieldError}>{registerForm.formState.errors.name.message}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>ФИО</label>
                  <input placeholder="Иванов Иван Иванович" {...registerForm.register('fullName')} />
                  {registerForm.formState.errors.fullName && (
                    <span className={styles.fieldError}>{registerForm.formState.errors.fullName.message}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Телефон</label>
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
                        shouldValidate: true, shouldDirty: true
                      })
                    }
                  />
                  {registerForm.formState.errors.phone && (
                    <span className={styles.fieldError}>{registerForm.formState.errors.phone.message}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Email</label>
                  <input placeholder="example@mail.ru" type="email" autoComplete="email" {...registerForm.register('email')} />
                  {registerForm.formState.errors.email && (
                    <span className={styles.fieldError}>{registerForm.formState.errors.email.message}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Пароль</label>
                  <label className={styles.passwordField}>
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      placeholder="Минимум 8 символов"
                      autoComplete="new-password"
                      {...registerPasswordField}
                      onChange={(e) => {
                        registerPasswordField.onChange(e);
                        void registerForm.trigger('password');
                      }}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowRegisterPassword((v) => !v)}
                      aria-label={showRegisterPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <EyeIcon open={showRegisterPassword} />
                    </button>
                  </label>
                  {shouldShowRegisterPasswordMessage && (
                    <span className={styles.fieldError}>{registerPasswordError}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Повторите пароль</label>
                  <label className={styles.passwordField}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Повторите пароль"
                      autoComplete="new-password"
                      {...confirmPasswordField}
                      onChange={(e) => {
                        confirmPasswordField.onChange(e);
                        if (registerForm.formState.submitCount > 0 || e.target.value.length > 0) {
                          void registerForm.trigger('confirmPassword');
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <EyeIcon open={showConfirmPassword} />
                    </button>
                  </label>
                  {shouldShowConfirmPasswordError && (
                    <span className={styles.fieldError}>{registerForm.formState.errors.confirmPassword?.message}</span>
                  )}
                </div>

                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  />
                  <span className={styles.consentText}>
                    Принимаю{' '}
                    <Link to="/service-rules" className={styles.policyLink}>Правила сервиса</Link>
                    {' '}и{' '}
                    <Link to="/privacy-policy" className={styles.policyLink}>Политику данных</Link>
                  </span>
                </label>

                <Turnstile
                  onToken={setRegisterCaptchaToken}
                  resetKey={registerCaptchaKey}
                />

                <Button
                  type="submit"
                  disabled={!privacyAccepted || (Boolean(import.meta.env.VITE_TURNSTILE_SITEKEY) && !registerCaptchaToken)}
                  className={styles.submitBtn}
                >
                  Создать аккаунт
                </Button>
              </form>

            ) : (

              /* ── Login form ── */
              <form onSubmit={loginForm.handleSubmit(onLogin)} className={styles.form}>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Телефон</label>
                  <input
                    placeholder="+7 (___) ___-__-__"
                    inputMode="tel"
                    autoComplete="tel"
                    value={loginForm.watch('phone') ?? ''}
                    onFocus={() => {
                      const v = loginForm.getValues('phone') ?? '';
                      if (!v) loginForm.setValue('phone', '+7', { shouldValidate: true });
                    }}
                    onChange={(e) =>
                      loginForm.setValue('phone', formatRuPhoneInput(e.target.value), {
                        shouldDirty: true, shouldValidate: true
                      })
                    }
                  />
                  {loginForm.formState.errors.phone && (
                    <span className={styles.fieldError}>{loginForm.formState.errors.phone.message}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabelRow}>
                    <label className={styles.fieldLabel}>Пароль</label>
                    <Link className={styles.forgot} to="/auth/forgot-password">Забыли пароль?</Link>
                  </div>
                  <label className={styles.passwordField}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="Ваш пароль"
                      autoComplete="current-password"
                      {...loginForm.register('password')}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowLoginPassword((v) => !v)}
                      aria-label={showLoginPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <EyeIcon open={showLoginPassword} />
                    </button>
                  </label>
                  {loginForm.formState.errors.password && (
                    <span className={styles.fieldError}>{loginForm.formState.errors.password.message}</span>
                  )}
                </div>

                <Turnstile
                  onToken={setLoginCaptchaToken}
                  resetKey={loginCaptchaKey}
                />

                <Button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={Boolean(import.meta.env.VITE_TURNSTILE_SITEKEY) && !loginCaptchaToken}
                >Войти</Button>
              </form>
            )}

            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.success}>{message}</p>}

            {!otpRequired && (
              <p className={styles.switchRow}>
                {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
                <Link className={styles.switchLink} to={isRegister ? '/auth/login' : '/auth/register'}>
                  {isRegister ? 'Войти' : 'Зарегистрироваться'}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* ── Hero ── */}
        <div className={styles.hero}>
          <div className={styles.heroGlow} />
          <img src={loginHero} alt="3D принтер печатает модель" />
        </div>
      </div>
    </section>
  );
};

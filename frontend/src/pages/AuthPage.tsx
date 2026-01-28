import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { useAuthStore } from '../app/store/authStore';
import styles from './AuthPage.module.css';

const RESEND_SECONDS = 30;

type Purpose = 'login' | 'register' | 'seller_verify';

const normalizePhone = (v: string) => (v ?? '').replace(/\D/g, '');

// Маска: +7 (___) ___-__-__
const formatRuPhone = (value: string) => {
  const digits = normalizePhone(value);

  // ввод "с 9": убираем ведущие 7/8
  let d = digits;
  if (d.startsWith('7')) d = d.slice(1);
  if (d.startsWith('8')) d = d.slice(1);

  // максимум 10 цифр
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

// На бэк отдаём единый формат: 7XXXXXXXXXX (11 цифр)
const toE164Ru = (value: string) => {
  const digits = normalizePhone(value);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const ten = last10.slice(0, 10);
  return ('7' + ten).slice(0, 11);
};

const loginSchema = z.object({
  email: z.string().email('Введите email'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  address: z.string().min(5, 'Введите адрес'),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname.includes('/register');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // OTP
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpPurpose, setOtpPurpose] = useState<Purpose>(isRegister ? 'register' : 'login');
  const [otpForm, setOtpForm] = useState({ phone: '', code: '' });
  const [resendLeft, setResendLeft] = useState(0);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('redirectTo');
  }, [location.search]);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const handleRedirect = (role?: string) => {
    if (redirectTo) {
      navigate(redirectTo);
      return;
    }
    navigate(role === 'seller' ? '/seller' : '/account');
  };

  const resetOtpUi = () => {
    setOtpRequired(false);
    setOtpSent(false);
    setOtpToken(null);
    setOtpForm({ phone: '', code: '' });
    setOtpLoading(false);
    setResendLeft(0);
  };

  const resetMessages = () => {
    setError('');
    setMessage('');
  };

  useEffect(() => {
    resetOtpUi();
    resetMessages();
    setOtpPurpose(isRegister ? 'register' : 'login');
    if (!isRegister) setPrivacyAccepted(false);
  }, [isRegister]);

  useEffect(() => {
    if (!otpSent) {
      setResendLeft(0);
      return;
    }

    setResendLeft(RESEND_SECONDS);
    const id = window.setInterval(() => {
      setResendLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [otpSent]);

  const onLogin = async (values: LoginValues) => {
    resetMessages();
    resetOtpUi();

    try {
      const result = await login(values.email, values.password);

      if (result.requiresOtp) {
        setOtpPurpose('login');
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);

        const phoneFromUser = result.user?.phone ?? '';
        setOtpForm({ phone: phoneFromUser ? formatRuPhone(phoneFromUser) : '', code: '' });

        setMessage('Подтвердите номер телефона для входа.');
        return;
      }

      handleRedirect(useAuthStore.getState().user?.role);
    } catch {
      setError('Неверный email или пароль.');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    resetMessages();
    resetOtpUi();

    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: toE164Ru(values.phone),
        address: values.address,
        privacyAccepted,
      });

      if (result.requiresOtp) {
        setOtpPurpose('register');
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);

        setOtpForm({ phone: formatRuPhone(values.phone), code: '' });
        setMessage('Подтвердите номер телефона для завершения регистрации.');
        return;
      }

      handleRedirect(useAuthStore.getState().user?.role);
    } catch {
      setError('Не удалось зарегистрироваться.');
    }
  };

  const handleOtpRequest = async () => {
    resetMessages();
    setOtpLoading(true);

    try {
      const phone = toE164Ru(otpForm.phone);

      // ввод "с 9"
      const ten = phone.slice(1);
      if (ten.length !== 10 || ten[0] !== '9') {
        setError('Введите номер в формате: +7 (9XX) XXX-XX-XX');
        return;
      }

      await requestOtp({ phone, purpose: otpPurpose }, otpToken);
      setOtpSent(true);
      setMessage('Код отправлен. Проверьте SMS.');
    } catch {
      setError('Не удалось отправить код.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    resetMessages();
    setOtpLoading(true);

    try {
      const phone = toE164Ru(otpForm.phone);

      await verifyOtp(
        {
          phone,
          code: otpForm.code.trim(),
          purpose: otpPurpose,
        },
        otpToken
      );

      handleRedirect(useAuthStore.getState().user?.role);
    } catch (e: any) {
      const msg =
        e?.message === 'PHONE_MISMATCH'
          ? 'Номер телефона не совпадает с учетной записью.'
          : 'Неверный код или время истекло.';
      setError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  // ВАЖНО: +7 не должен блокировать поле
  const phoneDigits = normalizePhone(otpForm.phone);
  const phoneReadonly =
    otpPurpose === 'login' &&
    phoneDigits.replace(/^7/, '').length === 10; // блокируем только когда есть полный номер

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <h1>{isRegister ? 'Регистрация' : 'Вход'}</h1>

        {otpRequired ? (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              otpSent ? handleOtpVerify() : handleOtpRequest();
            }}
          >
            <input
              placeholder="+7 (___) ___-__-__"
              value={otpForm.phone}
              readOnly={phoneReadonly}
              aria-readonly={phoneReadonly}
              className={phoneReadonly ? styles.readonly : undefined}
              inputMode="tel"
              onFocus={() => {
                if (!otpForm.phone) setOtpForm((p) => ({ ...p, phone: '+7' }));
              }}
              onChange={(e) => {
                if (phoneReadonly) return;
                const formatted = formatRuPhone(e.target.value);
                setOtpForm((p) => ({ ...p, phone: formatted }));
              }}
            />

            {otpSent && (
              <input
                placeholder="Код из SMS"
                value={otpForm.code}
                inputMode="numeric"
                onChange={(e) => setOtpForm((p) => ({ ...p, code: e.target.value }))}
              />
            )}

            {otpPurpose === 'register' && (
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
            )}

            <Button
              type="submit"
              disabled={
                otpLoading ||
                phoneDigits.replace(/^7/, '').length < 10 ||
                (otpSent && !otpForm.code.trim()) ||
                (otpPurpose === 'register' && !privacyAccepted)
              }
            >
              {otpSent ? 'Подтвердить' : 'Отправить код'}
            </Button>

            {otpSent && (
              <button
                type="button"
                className={styles.resend}
                disabled={otpLoading || resendLeft > 0}
                onClick={handleOtpRequest}
              >
                {resendLeft > 0 ? `Отправить ещё раз через ${resendLeft}с` : 'Отправить ещё раз'}
              </button>
            )}
          </form>
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
              onChange={(e) => {
                registerForm.setValue('phone', formatRuPhone(e.target.value), {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }}
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

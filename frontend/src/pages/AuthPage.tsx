import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { useAuthStore } from '../app/store/authStore';
import styles from './AuthPage.module.css';

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

export const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname.includes('/register');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpForm, setOtpForm] = useState({ phone: '', code: '' });
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('redirectTo');
  }, [location.search]);
  const otpPurpose = (isRegister ? 'register' : 'login') as 'login' | 'register';

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    setOtpRequired(false);
    setOtpToken(null);
    setOtpSent(false);
    setOtpForm({ phone: '', code: '' });
  }, [queryParams, isRegister]);

  const handleRedirect = (role?: string) => {
    if (redirectTo) {
      navigate(redirectTo);
      return;
    }
    if (role === 'seller') {
      navigate('/seller');
    } else {
      navigate('/account');
    }
  };

  const onLogin = async (values: LoginValues) => {
    setError('');
    try {
      const result = await login(values.email, values.password);
      if (result.requiresOtp) {
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpForm({ phone: result.user?.phone ?? '', code: '' });
        setMessage('Подтвердите номер телефона для входа.');
        return;
      }
      const role = useAuthStore.getState().user?.role;
      setMessage('Добро пожаловать!');
      handleRedirect(role);
    } catch {
      setError('Неверный email или пароль. Попробуйте снова.');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    setError('');
    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone,
        address: values.address,
        privacyAccepted
      });
      if (result.requiresOtp) {
        setOtpRequired(true);
        setOtpToken(result.tempToken ?? null);
        setOtpForm({ phone: values.phone, code: '' });
        setMessage('Подтвердите номер телефона для завершения регистрации.');
        return;
      }
      const role = useAuthStore.getState().user?.role;
      setMessage('Регистрация завершена!');
      handleRedirect(role);
    } catch {
      setError('Пользователь с таким email уже существует.');
    }
  };

  const handleOtpRequest = async () => {
    setError('');
    setMessage('');
    setOtpLoading(true);
    try {
      await requestOtp({ phone: otpForm.phone, purpose: otpPurpose }, otpToken);
      setOtpSent(true);
      setMessage('Код отправлен. Проверьте SMS.');
    } catch {
      setError('Не удалось отправить код. Проверьте номер и попробуйте снова.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    setError('');
    setMessage('');
    setOtpLoading(true);
    try {
      await verifyOtp(
        {
          phone: otpForm.phone,
          code: otpForm.code,
          purpose: otpPurpose
        },
        otpToken
      );
      const role = useAuthStore.getState().user?.role;
      setMessage('Телефон подтвержден!');
      handleRedirect(role);
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'PHONE_MISMATCH'
          ? 'Номер телефона не совпадает с учетной записью.'
          : 'Неверный код или истекло время действия.';
      setError(message);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <h1>{isRegister ? 'Регистрация' : 'Вход'}</h1>
        {otpRequired ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (otpSent) {
                handleOtpVerify();
              } else {
                handleOtpRequest();
              }
            }}
            className={styles.form}
          >
            <input
              placeholder="Телефон"
              value={otpForm.phone}
              onChange={(event) => setOtpForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            {otpSent && (
              <input
                placeholder="Код из SMS"
                value={otpForm.code}
                onChange={(event) => setOtpForm((prev) => ({ ...prev, code: event.target.value }))}
              />
            )}
            {isRegister && (
              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                />
                <span>
                  Я соглашаюсь на{' '}
                  <Link to="/privacy-policy" className={styles.policyLink}>
                    обработку персональных данных
                  </Link>{' '}
                  и подтверждаю, что ознакомился с Политикой обработки персональных данных
                </span>
              </label>
            )}
            <Button
              type="submit"
              disabled={
                otpLoading ||
                (isRegister && !privacyAccepted) ||
                !otpForm.phone ||
                (otpSent && !otpForm.code)
              }
            >
              {otpSent ? 'Подтвердить' : 'Отправить код'}
            </Button>
          </form>
        ) : isRegister ? (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className={styles.form}>
            <input placeholder="Имя" {...registerForm.register('name')} />
            {registerForm.formState.errors.name && (
              <span>{registerForm.formState.errors.name.message}</span>
            )}
            <input placeholder="Телефон" {...registerForm.register('phone')} />
            {registerForm.formState.errors.phone && (
              <span>{registerForm.formState.errors.phone.message}</span>
            )}
            <input placeholder="Адрес" {...registerForm.register('address')} />
            {registerForm.formState.errors.address && (
              <span>{registerForm.formState.errors.address.message}</span>
            )}
            <input placeholder="Email" {...registerForm.register('email')} />
            {registerForm.formState.errors.email && (
              <span>{registerForm.formState.errors.email.message}</span>
            )}
            <input type="password" placeholder="Пароль" {...registerForm.register('password')} />
            {registerForm.formState.errors.password && (
              <span>{registerForm.formState.errors.password.message}</span>
            )}
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
              />
              <span>
                Я соглашаюсь на{' '}
                <Link to="/privacy-policy" className={styles.policyLink}>
                  обработку персональных данных
                </Link>{' '}
                и подтверждаю, что ознакомился с Политикой обработки персональных данных
              </span>
            </label>
            <Button type="submit" disabled={!privacyAccepted}>
              Создать аккаунт
            </Button>
          </form>
        ) : (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className={styles.form}>
            <input placeholder="Email" {...loginForm.register('email')} />
            {loginForm.formState.errors.email && (
              <span>{loginForm.formState.errors.email.message}</span>
            )}
            <input type="password" placeholder="Пароль" {...loginForm.register('password')} />
            {loginForm.formState.errors.password && (
              <span>{loginForm.formState.errors.password.message}</span>
            )}
            <Button type="submit">Войти</Button>
          </form>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}
        <Link className={styles.switch} to={isRegister ? '/auth/login' : '/auth/register'}>
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </Link>
        <div className={styles.hint}>
          <p>Тестовые аккаунты:</p>
          <p>buyer@test.com / buyer123</p>
          <p>seller@test.com / seller123</p>
        </div>
      </div>
    </section>
  );
};

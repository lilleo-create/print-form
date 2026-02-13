import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { api } from '../shared/api';
import styles from './ForgotPasswordPage.module.css';

const normalizePhone = (v: string) => (v ?? '').replace(/\D/g, '');

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

const toE164Ru = (value: string) => {
  const digits = normalizePhone(value);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const ten = last10.slice(0, 10);
  return ('7' + ten).slice(0, 11);
};

type Step = 'request' | 'verify' | 'reset';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError('');
    setMessage('');
  };

  const handleRequest = async () => {
    resetMessages();
    setLoading(true);
    try {
      const v11 = toE164Ru(phone);
      await api.requestPasswordReset({ phone: v11 });
      setStep('verify');
      setMessage('Код отправлен. Проверьте SMS.');
    } catch {
      setError('Не удалось отправить код.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    resetMessages();
    setLoading(true);
    try {
      const v11 = toE164Ru(phone);
      const response = await api.verifyPasswordReset({ phone: v11, code: code.trim() });
      setResetToken(response.data.resetToken);
      setStep('reset');
    } catch {
      setError('Неверный код или время истекло.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    resetMessages();
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await api.confirmPasswordReset({ token: resetToken, password });
      navigate('/auth/login', { state: { message: 'Пароль обновлён' }, replace: true });
    } catch {
      setError('Не удалось обновить пароль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <h1>Сброс пароля</h1>
        {step === 'request' && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void handleRequest();
            }}
          >
            <input
              placeholder="+7 (___) ___-__-__"
              value={phone}
              inputMode="tel"
              onFocus={() => {
                if (!phone) setPhone('+7');
              }}
              onChange={(event) => setPhone(formatRuPhone(event.target.value))}
            />
            <Button type="submit" disabled={loading}>
              Отправить код
            </Button>
          </form>
        )}

        {step === 'verify' && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void handleVerify();
            }}
          >
            <input
              placeholder="Код из SMS"
              value={code}
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" disabled={loading}>
              Подтвердить код
            </Button>
          </form>
        )}

        {step === 'reset' && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            <input
              type="password"
              placeholder="Новый пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              type="password"
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" disabled={loading}>
              Обновить пароль
            </Button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}
        {step === 'request' && (
          <div className={styles.hint}>
            <span>Введите номер телефона, чтобы получить код для сброса пароля.</span>
          </div>
        )}
      </div>
    </section>
  );
};

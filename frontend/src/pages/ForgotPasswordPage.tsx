import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { api } from '../shared/api';
import { normalizeApiError } from '../shared/api/client';
import { formatRuPhoneInput, normalizePhone, toE164Ru } from '../shared/lib/validation';
import styles from './ForgotPasswordPage.module.css';

type Step = 'request' | 'verify' | 'call_to_auth' | 'reset';
type DeliveryData = {
  requestId?: string;
  provider?: string;
  verificationType?: 'call_to_auth' | 'code';
  callToAuthNumber?: string | null;
  phone?: string;
  status?: string;
  expiresInSec?: number;
};

const POLL_INTERVAL_MS = 3000;

const formatCallToAuthPhone = (value: string | null | undefined) => (value ? formatRuPhoneInput(value) : 'номер недоступен');
const toTelHref = (value: string | null | undefined) => {
  const digits = normalizePhone(value ?? '');
  if (!digits) return '';
  return digits.startsWith('8') ? `tel:+7${digits.slice(1)}` : `tel:+${digits}`;
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const pollingRef = useRef<number | null>(null);

  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [callToAuthNumber, setCallToAuthNumber] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedPhone = useMemo(() => toE164Ru(phone), [phone]);

  const resetMessages = () => {
    setError('');
    setMessage('');
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const finishResetVerification = useCallback(async (payload: { phone: string; code?: string; requestId?: string }) => {
    const response = await api.verifyPasswordReset(payload);
    setResetToken(response.data.resetToken);
    setStep('reset');
    setMessage('Задайте новый пароль.');
  }, []);

  const startPolling = useCallback((currentRequestId: string, currentPhone: string) => {
    stopPolling();
    pollingRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const status = await api.otpStatus(currentRequestId);
          if (status.data.data.status === 'verified') {
            stopPolling();
            setLoading(true);
            try {
              await finishResetVerification({ phone: currentPhone, requestId: currentRequestId });
            } catch {
              setError('Подтверждение прошло, но не удалось открыть смену пароля. Попробуйте запросить сброс снова.');
              setStep('request');
            } finally {
              setLoading(false);
            }
            return;
          }

          if (['expired', 'failed', 'cancelled'].includes(status.data.data.status)) {
            stopPolling();
            setStep('request');
            setError('Время ожидания звонка истекло. Запросите сброс ещё раз.');
          }
        } catch {
          stopPolling();
          setStep('request');
          setError('Не удалось проверить статус подтверждения.');
        }
      })();
    }, POLL_INTERVAL_MS);
  }, [finishResetVerification, stopPolling]);

  const handleRequest = async () => {
    resetMessages();
    setLoading(true);
    try {
      const response = await api.requestPasswordReset({ phone: normalizedPhone });
      const delivery = response.data.delivery as DeliveryData | undefined;

      setRequestId(delivery?.requestId ?? null);
      setCallToAuthNumber(delivery?.callToAuthNumber ?? null);
      if (delivery?.phone) {
        setPhone(formatRuPhoneInput(delivery.phone));
      }

      if (delivery?.verificationType === 'call_to_auth' && delivery.requestId) {
        setStep('call_to_auth');
        setMessage('Позвоните на указанный номер. После подтверждения откроется смена пароля.');
        startPolling(delivery.requestId, delivery.phone ?? normalizedPhone);
        return;
      }

      setStep('verify');
      setMessage('Код отправлен. Введите код подтверждения.');
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'NOT_FOUND') {
        setError('Пользователь с таким номером телефона не найден.');
      } else {
        setError('Не удалось начать сброс пароля.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    resetMessages();
    setLoading(true);
    try {
      await finishResetVerification({ phone: normalizedPhone, code: code.trim(), requestId: requestId ?? undefined });
    } catch {
      setError('Неверный код или время действия подтверждения истекло.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    resetMessages();
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
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
              autoComplete="tel"
              onFocus={() => {
                if (!phone) setPhone('+7');
              }}
              onChange={(event) => setPhone(formatRuPhoneInput(event.target.value))}
            />
            <Button type="submit" disabled={loading} isLoading={loading}>
              Продолжить
            </Button>
          </form>
        )}

        {step === 'call_to_auth' && (
          <div className={styles.flow}>
            <div className={styles.callToAuthCard}>
              <h2 className={styles.callToAuthTitle}>Подтверждение номера</h2>
              <p className={styles.callToAuthSubtitle}>Позвоните на номер ниже с телефона, который хотите восстановить.</p>
              <a href={toTelHref(callToAuthNumber)} className={styles.callToAuthPhone}>
                {formatCallToAuthPhone(callToAuthNumber)}
              </a>
              <p className={styles.callToAuthHint}>После успешного подтверждения откроется экран нового пароля автоматически.</p>
            </div>
            {error ? (
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleRequest()}>
                Запросить звонок повторно
              </Button>
            ) : null}
          </div>
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
              placeholder="Код подтверждения"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" disabled={loading} isLoading={loading}>
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
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              type="password"
              placeholder="Повторите пароль"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" disabled={loading} isLoading={loading}>
              Обновить пароль
            </Button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}
        {step === 'request' && (
          <div className={styles.hint}>
            <span>Введите номер телефона, чтобы начать сброс пароля.</span>
          </div>
        )}
      </div>
    </section>
  );
};

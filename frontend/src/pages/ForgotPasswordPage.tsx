import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { api } from '../shared/api';
import { normalizeApiError } from '../shared/api/client';
import { formatRuPhoneInput, normalizePhone, toE164Ru } from '../shared/lib/validation';
import styles from './ForgotPasswordPage.module.css';

type Step = 'request' | 'call_to_auth' | 'reset';
type DeliveryData = {
  requestId?: string;
  provider?: string;
  verificationType?: 'call_to_auth' | 'code';
  callToAuthNumber?: string | null;
  phone?: string;
  status?: string;
  expiresInSec?: number;
};

type PasswordResetRequestResponse = {
  ok?: boolean;
  success?: boolean;
  delivery?: DeliveryData;
  data?: DeliveryData | { delivery?: DeliveryData };
};

const POLL_INTERVAL_MS = 3000;

const formatCallToAuthPhone = (value: string | null | undefined) => (value ? formatRuPhoneInput(value) : 'номер недоступен');
const toTelHref = (value: string | null | undefined) => {
  const digits = normalizePhone(value ?? '');
  if (!digits) return '';
  return digits.startsWith('8') ? `tel:+7${digits.slice(1)}` : `tel:+${digits}`;
};

const isDeliveryData = (value: unknown): value is DeliveryData => {
  if (!value || typeof value !== 'object') return false;

  return [
    'requestId',
    'provider',
    'verificationType',
    'callToAuthNumber',
    'phone',
    'status',
    'expiresInSec'
  ].some((key) => key in value);
};

const extractDelivery = (payload: PasswordResetRequestResponse | undefined): DeliveryData | null => {
  if (!payload || typeof payload !== 'object') return null;

  if (isDeliveryData(payload.delivery)) {
    return payload.delivery;
  }

  if (payload.data && typeof payload.data === 'object') {
    const nestedData = 'delivery' in payload.data ? payload.data.delivery : payload.data;
    if (isDeliveryData(nestedData)) {
      return nestedData;
    }
  }

  return null;
};

const isSuccessfulRecoveryRequest = (payload: PasswordResetRequestResponse | undefined, delivery: DeliveryData | null) => {
  if (!payload || !delivery) return false;

  return (
    payload.ok === true ||
    payload.success === true ||
    delivery.verificationType === 'call_to_auth' ||
    Boolean(delivery.requestId) ||
    Boolean(delivery.callToAuthNumber)
  );
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const pollingRef = useRef<number | null>(null);

  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [callToAuthNumber, setCallToAuthNumber] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [canRetryCall, setCanRetryCall] = useState(false);
  const [callDeadlineAt, setCallDeadlineAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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

  useEffect(() => {
    if (!callDeadlineAt) {
      setSecondsLeft(null);
      return;
    }

    const updateSecondsLeft = () => {
      const next = Math.max(0, Math.ceil((callDeadlineAt - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) {
        setCanRetryCall(true);
      }
    };

    updateSecondsLeft();
    const timerId = window.setInterval(updateSecondsLeft, 1000);
    return () => window.clearInterval(timerId);
  }, [callDeadlineAt]);

  const finishResetVerification = useCallback(async (payload: { phone: string; requestId?: string }) => {
    const response = await api.verifyPasswordReset(payload);
    setResetToken(response.data.resetToken);
    setStep('reset');
    setCanRetryCall(false);
    setCallDeadlineAt(null);
    setMessage('Подтверждение прошло. Теперь задайте новый пароль.');
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
              setCanRetryCall(true);
              setError('Подтверждение прошло, но не удалось открыть смену пароля. Попробуйте запросить звонок ещё раз.');
              setStep('request');
            } finally {
              setLoading(false);
            }
            return;
          }

          if (['expired', 'failed', 'cancelled'].includes(status.data.data.status)) {
            stopPolling();
            setCanRetryCall(true);
            setError('Подтверждение звонком не завершилось вовремя. Запросите звонок повторно.');
          }
        } catch {
          stopPolling();
          setCanRetryCall(true);
          setError('Не удалось проверить статус подтверждения. Запросите звонок повторно.');
        }
      })();
    }, POLL_INTERVAL_MS);
  }, [finishResetVerification, stopPolling]);

  const handleRequest = async () => {
    resetMessages();
    stopPolling();
    setLoading(true);
    try {
      const response = await api.requestPasswordReset({ phone: normalizedPhone });
      const payload = response.data as PasswordResetRequestResponse | undefined;
      const delivery = extractDelivery(payload);

      setCallToAuthNumber(delivery?.callToAuthNumber ?? null);
      setCanRetryCall(false);
      setCallDeadlineAt(delivery?.expiresInSec ? Date.now() + delivery.expiresInSec * 1000 : null);
      if (delivery?.phone) {
        setPhone(formatRuPhoneInput(delivery.phone));
      }

      if (isSuccessfulRecoveryRequest(payload, delivery)) {
        setStep('call_to_auth');
        setMessage('Ожидаем подтверждение звонком. После успешного подтверждения откроется экран нового пароля.');
        if (delivery?.requestId) {
          startPolling(delivery.requestId, delivery.phone ?? normalizedPhone);
        }
        return;
      }

      setStep('request');
      setCanRetryCall(true);
      setError('Не удалось запустить подтверждение звонком. Попробуйте ещё раз.');
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'NOT_FOUND') {
        setError('Пользователь с таким номером телефона не найден.');
      } else {
        setError('Не удалось начать восстановление пароля.');
      }
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
              <h2 className={styles.callToAuthTitle}>Ожидаем подтверждение звонком</h2>
              <p className={styles.callToAuthSubtitle}>
                Чтобы подтвердить восстановление, позвоните на номер ниже с телефона, для которого восстанавливаете доступ.
              </p>
              <a href={toTelHref(callToAuthNumber)} className={styles.callToAuthPhone}>
                {formatCallToAuthPhone(callToAuthNumber)}
              </a>
              <p className={styles.callToAuthHint}>
                Подтверждение выполняется автоматически после звонка. Мы сами переведём вас к созданию нового пароля.
              </p>
              {secondsLeft !== null && secondsLeft > 0 && (
                <p className={styles.callToAuthMeta}>Обычно это занимает до {secondsLeft} сек.</p>
              )}
              {!canRetryCall && (
                <p className={styles.callToAuthMeta}>Если подтверждение не произойдёт в течение ожидания, появится возможность запросить звонок повторно.</p>
              )}
            </div>
            {canRetryCall && (
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleRequest()}>
                Запросить звонок повторно
              </Button>
            )}
          </div>
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
            <span>Введите номер телефона, и мы запустим подтверждение для восстановления пароля звонком.</span>
          </div>
        )}
      </div>
    </section>
  );
};

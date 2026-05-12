import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { authApi } from '../shared/api/authApi';
import { normalizeApiError } from '../shared/api/client';
import { loadFromStorage, removeFromStorage, saveToStorage } from '../shared/lib/storage';
import { STORAGE_KEYS } from '../shared/constants/storageKeys';
import { formatRuPhoneInput, toCanonicalRuPhone, toE164Ru } from '../shared/lib/validation';
import { OtpStep } from './OtpStep';
import styles from './ForgotPasswordPage.module.css';

type Step = 'request' | 'otp' | 'reset';

type PersistedResetFlow = {
  step: Step;
  phone: string;
  tempToken: string;
  resetToken: string;
  challengePhone: string;
  otpRequest: {
    requestId: string;
    verificationType: 'call_to_auth';
    callToAuthNumber?: string | null;
    phone?: string;
    status?: string;
    expiresInSec?: number;
  } | null;
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [challengePhone, setChallengePhone] = useState('');
  const [otpRequest, setOtpRequest] = useState<PersistedResetFlow['otpRequest']>(null);
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

  const clearPersistedFlow = () => {
    removeFromStorage(STORAGE_KEYS.passwordResetFlow);
  };

  useEffect(() => {
    const stored = loadFromStorage<PersistedResetFlow | null>(STORAGE_KEYS.passwordResetFlow, null);
    if (!stored?.phone) {
      return;
    }

    setPhone(stored.phone);
    setTempToken(stored.tempToken ?? '');
    setResetToken(stored.resetToken ?? '');
    setChallengePhone(stored.challengePhone ?? '');
    setOtpRequest(stored.otpRequest ?? null);
    setStep(stored.step ?? 'request');
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.passwordResetFlow, {
      step,
      phone,
      tempToken,
      resetToken,
      challengePhone,
      otpRequest,
    } satisfies PersistedResetFlow);
  }, [challengePhone, otpRequest, phone, tempToken, resetToken, step]);

  const handleRequest = async () => {
    resetMessages();
    setLoading(true);

    try {
      const request = await authApi.requestPasswordReset({ phone: normalizedPhone });
      if (!request.requiresOtp || !request.otpRequest || request.otpRequest.verificationType !== 'call_to_auth') {
        setError('Не удалось запустить подтверждение звонком. Попробуйте ещё раз.');
        return;
      }

      setTempToken(request.tempToken ?? '');
      setOtpRequest(request.otpRequest);
      setChallengePhone(toCanonicalRuPhone(request.phone || request.otpRequest.phone || normalizedPhone));
      setStep('otp');
      setMessage('Подтвердите восстановление пароля звонком. После подтверждения откроется форма нового пароля.');
      setPhone(formatRuPhoneInput(request.phone || request.otpRequest.phone || normalizedPhone));
    } catch (rawError) {
      const normalized = normalizeApiError(rawError);
      if (normalized.code === 'NOT_FOUND') {
        setError('Пользователь с таким номером телефона не найден.');
      } else if (normalized.status === 429) {
        setError('Слишком много запросов. Попробуйте чуть позже.');
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
      await authApi.confirmPasswordReset({ token: resetToken, password });
      clearPersistedFlow();
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

        {step === 'otp' && (
          <OtpStep
            tempToken={tempToken}
            initialPhone={phone}
            initialRequest={otpRequest}
            flowType="password_reset_verification"
            title="Подтвердите восстановление пароля"
            introMessage="Ожидаем автоматическое подтверждение восстановления после звонка."
            idleMessage="Подготавливаем подтверждение для восстановления пароля…"
            onRequestOtp={async ({ phone: requestPhone }) => {
              const request = await authApi.requestPasswordReset({ phone: requestPhone });
              setTempToken(request.tempToken ?? '');
              setOtpRequest(request.otpRequest);
              setChallengePhone(toCanonicalRuPhone(request.phone || request.otpRequest?.phone || requestPhone));
              return { otpRequest: request.otpRequest, tempToken: request.tempToken ?? '' };
            }}
            onCheckOtpStatus={async (requestId, token) => authApi.checkOtpStatus(requestId, token)}
            onVerifyOtp={async ({ requestId }, token) => {
              const tokenForReset = await authApi.completePasswordResetVerification(
                { phone: challengePhone, requestId },
                token
              );
              setResetToken(tokenForReset);
              setStep('reset');
              setMessage('Подтверждение прошло. Теперь задайте новый пароль.');
            }}
            onSuccess={() => {
              setOtpRequest(null);
            }}
            setMessage={setMessage}
            setError={setError}
            onBack={() => {
              setStep('request');
              setTempToken('');
              setChallengePhone('');
              setOtpRequest(null);
              resetMessages();
            }}
          />
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
        {step !== 'request' && (
          <div className={styles.hint}>
            <span>
              Номер для подтверждения и статус звонка берутся из существующего OTP flow проекта без старой SMS-логики.
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

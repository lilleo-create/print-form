import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../shared/ui/Button';
import styles from './AuthPage.module.css';

type DeviceVerificationStatus = 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled';

type VerificationChannel = 'PHONE_CALL' | 'SMS' | 'PUSH' | 'UNKNOWN';

type DeviceVerificationInfo = {
  channel: VerificationChannel;
  phone: string | null;
  reason: string | null;
};

const POLL_INTERVAL_MS = 3000;

const normalizePhone = (v: string) => (v ?? '').replace(/\D/g, '');

const formatRuPhone = (value: string | null) => {
  const digits = normalizePhone(value ?? '');
  if (!digits) return 'указанный номер';

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

export function DeviceVerificationStep(props: {
  tempToken: string | null;
  verification: DeviceVerificationInfo;
  onCheckStatus: (token: string) => Promise<{ status: DeviceVerificationStatus; verificationResult?: string | Record<string, unknown> | null }>;
  onComplete: (payload: { verificationResult?: string | Record<string, unknown> | null }, token: string) => Promise<void>;
  onSuccess: () => void;
  onBack: () => void;
  setMessage: (v: string) => void;
  setError: (v: string) => void;
}) {
  const { tempToken, verification } = props;
  const [status, setStatus] = useState<DeviceVerificationStatus>('pending');
  const [isCompleting, setIsCompleting] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const completeLogin = useCallback(async (verificationResult?: string | Record<string, unknown> | null) => {
    if (!tempToken) {
      props.setError('Не удалось продолжить вход. Повторите авторизацию.');
      return;
    }

    setIsCompleting(true);
    try {
      await props.onComplete({ verificationResult }, tempToken);
      props.onSuccess();
    } catch {
      props.setError('Не удалось завершить вход после подтверждения устройства.');
      setStatus('failed');
    } finally {
      setIsCompleting(false);
    }
  }, [props, tempToken]);

  useEffect(() => {
    props.setError('');
    props.setMessage('Ожидаем автоматическое подтверждение нового устройства.');
    setStatus('pending');
    stopPolling();

    if (!tempToken) {
      props.setError('Не удалось продолжить вход. Повторите авторизацию.');
      return;
    }

    pollingRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const result = await props.onCheckStatus(tempToken);
          setStatus(result.status);

          if (result.status === 'verified') {
            stopPolling();
            await completeLogin(result.verificationResult);
            return;
          }

          if (result.status === 'expired' || result.status === 'failed' || result.status === 'cancelled') {
            stopPolling();
            props.setError('Подтверждение нового устройства не было завершено. Попробуйте войти снова.');
          }
        } catch {
          stopPolling();
          setStatus('failed');
          props.setError('Не удалось проверить статус подтверждения устройства.');
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [completeLogin, props, stopPolling, tempToken]);

  const formattedPhone = useMemo(() => formatRuPhone(verification.phone), [verification.phone]);
  const isWaiting = status === 'pending' || isCompleting;

  return (
    <div className={styles.form}>
      <div className={styles.callToAuthCard}>
        <h2 className={styles.callToAuthTitle}>Подтвердите вход</h2>
        <p className={styles.callToAuthSubtitle}>
          {verification.channel === 'PHONE_CALL'
            ? `Мы позвоним на номер ${formattedPhone}`
            : `Подтверждение будет отправлено на ${formattedPhone}`}
        </p>
        <p className={styles.callToAuthHint}>
          {verification.reason ?? 'Подтверждение выполняется автоматически для нового устройства.'}
        </p>
      </div>

      <div className={styles.verificationStatusCard}>
        <div className={styles.verificationSpinner} aria-hidden="true" />
        <div>
          <p className={styles.verificationStatusTitle}>
            {isWaiting ? 'Ожидаем подтверждение' : 'Подтверждение остановлено'}
          </p>
          <p className={styles.verificationStatusText}>
            {isWaiting
              ? 'Не закрывайте страницу — вход завершится автоматически без перезагрузки.'
              : 'Сессия подтверждения завершилась с ошибкой или истекла.'}
          </p>
        </div>
      </div>

      {(status === 'failed' || status === 'expired' || status === 'cancelled') && (
        <Button type="button" variant="secondary" onClick={props.onBack}>
          Вернуться ко входу
        </Button>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { normalizeApiError } from '../shared/api/client';
import styles from './AuthPage.module.css';

type Purpose = 'buyer_register_phone' | 'buyer_change_phone' | 'buyer_sensitive_action' | 'seller_connect_phone' | 'seller_change_payout_details' | 'seller_payout_settings_verify';
type OtpRequestData = {
  requestId: string;
  verificationType: 'call_to_auth' | 'code';
  callToAuthNumber?: string | null;
  phone?: string;
};
type OtpUiState = 'idle' | 'requesting' | 'call_to_auth' | 'error';

const POLL_INTERVAL_MS = 3000;

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

const toTelHref = (value: string | null) => {
  const digits = normalizePhone(value ?? '');
  if (!digits) return '';
  return digits.startsWith('8') ? `tel:+7${digits.slice(1)}` : `tel:+${digits}`;
};

export function OtpStep(props: {
  purpose: Purpose;
  tempToken: string | null;
  initialPhone?: string;
  onRequestOtp: (p: { phone: string; purpose: Purpose }, token?: string | null) => Promise<OtpRequestData | null>;
  onCheckOtpStatus: (requestId: string, token?: string | null) => Promise<'pending' | 'verified' | 'expired' | 'failed' | 'cancelled'>;
  onVerifyOtp: (p: { phone: string; code?: string; requestId?: string; purpose: Purpose }, token?: string | null) => Promise<void>;
  onSuccess: () => void;
  setMessage: (v: string) => void;
  setError: (v: string) => void;
}) {
  const { purpose, tempToken, initialPhone } = props;

  const [otpUiState, setOtpUiState] = useState<OtpUiState>('idle');
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [callToAuthNumber, setCallToAuthNumber] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const autoRequestedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopPolling();
    setOtpUiState('idle');
    setRequestId(null);
    setCallToAuthNumber(null);
    setPhone(initialPhone ? formatRuPhone(initialPhone) : '');
    autoRequestedRef.current = false;
  }, [initialPhone, purpose, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);

  const validateRuPhone = (v11: string) => {
    const ten = v11.slice(1);
    return ten.length === 10 && ten[0] === '9';
  };

  const request = useCallback(async () => {
    props.setError('');
    props.setMessage('');
    setOtpUiState('requesting');

    try {
      const v11 = toE164Ru(phone);
      if (!validateRuPhone(v11)) {
        props.setError('Введите номер в формате: +7 (9XX) XXX-XX-XX');
        setOtpUiState('error');
        return;
      }

      const data = await props.onRequestOtp({ phone: v11, purpose }, tempToken);
      if (!data?.requestId || !data?.verificationType) {
        props.setError('Не удалось начать подтверждение номера. Попробуйте ещё раз.');
        setOtpUiState('error');
        return;
      }

      setRequestId(data.requestId);

      if (data.verificationType !== 'call_to_auth') {
        setOtpUiState('error');
        props.setError('Не удалось начать подтверждение звонком. Попробуйте ещё раз.');
        return;
      }

      setOtpUiState('call_to_auth');
      setCallToAuthNumber(data.callToAuthNumber ?? null);
      if (data.phone) {
        setPhone(formatRuPhone(data.phone));
      }
      props.setMessage('Ожидаем подтверждение звонком.');

      stopPolling();
      pollingRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const status = await props.onCheckOtpStatus(data.requestId, tempToken);
            if (status === 'verified') {
              stopPolling();
              await props.onVerifyOtp({ phone: v11, requestId: data.requestId, purpose }, tempToken);
              props.onSuccess();
              return;
            }
            if (status === 'expired' || status === 'failed' || status === 'cancelled') {
              stopPolling();
              setOtpUiState('error');
              props.setError('Время ожидания звонка истекло. Запросите подтверждение снова.');
            }
          } catch {
            stopPolling();
            setOtpUiState('error');
            props.setError('Не удалось проверить статус подтверждения.');
          }
        })();
      }, POLL_INTERVAL_MS);
    } catch (error) {
      const normalized = normalizeApiError(error);
      setOtpUiState('error');
      if (normalized.code === 'OTP_PROVIDER_UNAVAILABLE') {
        props.setError('Не удалось начать подтверждение номера. Попробуйте ещё раз.');
      } else {
        props.setError('Не удалось отправить код.');
      }
    }
  }, [phone, props, purpose, stopPolling, tempToken]);

  useEffect(() => {
    if (autoRequestedRef.current) return;
    if (phoneDigits.replace(/^7/, '').length < 10) return;

    autoRequestedRef.current = true;
    void request();
  }, [phoneDigits, request]);

  const isBusy = otpUiState === 'requesting';
  const callToAuthDisplayNumber = callToAuthNumber ? formatRuPhone(callToAuthNumber) : null;
  const callToAuthTelHref = toTelHref(callToAuthNumber);

  return (
    <div className={styles.form}>
      {otpUiState === 'call_to_auth' && (
        <div className={styles.callToAuthCard}>
          <h2 className={styles.callToAuthTitle}>Подтверждение номера</h2>
          <p className={styles.callToAuthSubtitle}>Позвоните на</p>
          <a href={callToAuthTelHref} className={styles.callToAuthPhone}>
            {callToAuthDisplayNumber ?? 'номер недоступен'}
          </a>
          <p className={styles.callToAuthHint}>Звонок бесплатный. Подтверждение произойдёт автоматически.</p>
        </div>
      )}

      {otpUiState === 'call_to_auth' && (
        <Button type="button" disabled={isBusy || !requestId} onClick={() => void request()} variant="secondary">
          Запросить звонок повторно
        </Button>
      )}

      {otpUiState === 'idle' && <p className={styles.subtitle}>Подготавливаем подтверждение номера…</p>}
    </div>
  );
}

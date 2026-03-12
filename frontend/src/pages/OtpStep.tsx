import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { normalizeApiError } from '../shared/api/client';
import styles from './AuthPage.module.css';

type Purpose = 'buyer_register_phone' | 'buyer_change_phone' | 'buyer_sensitive_action' | 'seller_connect_phone' | 'seller_change_payout_details' | 'seller_payout_settings_verify';
type OtpRequestData = {
  requestId: string;
  provider?: string;
  verificationType: 'call_to_auth' | 'code';
  callToAuthNumber?: string | null;
  phone?: string;
  status?: string;
  expiresInSec?: number;
};
type OtpUiState = 'idle' | 'requesting' | 'call_to_auth' | 'code' | 'error';

const RESEND_SECONDS = 30;
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

export function OtpStep(props: {
  purpose: Purpose;
  tempToken: string | null;
  initialPhone?: string;
  privacyAccepted: boolean;
  onPrivacyAcceptedChange: (v: boolean) => void;
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
  const [code, setCode] = useState('');
  const [resendLeft, setResendLeft] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [callToAuthNumber, setCallToAuthNumber] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [otpStatus, setOtpStatus] = useState<string | null>(null);
  const [expiresInSec, setExpiresInSec] = useState<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    stopPolling();
    setOtpUiState('idle');
    setCode('');
    setResendLeft(0);
    setRequestId(null);
    setCallToAuthNumber(null);
    setProvider(null);
    setOtpStatus(null);
    setExpiresInSec(null);
    setPhone(initialPhone ? formatRuPhone(initialPhone) : '');
  }, [purpose, initialPhone]);

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (otpUiState !== 'code') {
      setResendLeft(0);
      return;
    }

    setResendLeft(RESEND_SECONDS);
    const id = window.setInterval(() => setResendLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [otpUiState]);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);

  const phoneReadonly = purpose === 'buyer_register_phone' && phoneDigits.replace(/^7/, '').length === 10;

  const canSubmit =
    phoneDigits.replace(/^7/, '').length >= 10 &&
    (otpUiState !== 'code' || Boolean(code.trim())) &&
    (purpose !== 'buyer_register_phone' || props.privacyAccepted);

  const validateRuPhone = (v11: string) => {
    const ten = v11.slice(1);
    return ten.length === 10 && ten[0] === '9';
  };

  const request = async () => {
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
      setProvider(data.provider ?? null);
      setOtpStatus(data.status ?? 'pending');
      setExpiresInSec(data.expiresInSec ?? null);

      if (data.verificationType === 'call_to_auth') {
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
              setOtpStatus(status);
              if (status === 'verified') {
                stopPolling();
                await props.onVerifyOtp({ phone: v11, requestId: data.requestId, purpose }, tempToken);
                props.onSuccess();
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
      } else {
        setOtpUiState('code');
        setCallToAuthNumber(null);
        props.setMessage('Код отправлен.');
      }
    } catch (error) {
      const normalized = normalizeApiError(error);
      setOtpUiState('error');
      if (normalized.code === 'OTP_PROVIDER_UNAVAILABLE') {
        props.setError('Не удалось начать подтверждение номера. Попробуйте ещё раз.');
      } else {
        props.setError('Не удалось отправить код.');
      }
    }
  };

  const verify = async () => {
    props.setError('');
    props.setMessage('');
    setOtpUiState('requesting');

    try {
      const v11 = toE164Ru(phone);
      await props.onVerifyOtp({ phone: v11, code: code.trim(), purpose }, tempToken);
      props.onSuccess();
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message === 'PHONE_MISMATCH'
          ? 'Номер телефона не совпадает с учетной записью.'
          : 'Неверный код или время истекло.';
      setOtpUiState('error');
      props.setError(msg);
    }
  };

  const isBusy = otpUiState === 'requesting';

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (otpUiState === 'code') {
          void verify();
          return;
        }
        if (otpUiState !== 'call_to_auth') {
          void request();
        }
      }}
    >
      <input
        placeholder="+7 (___) ___-__-__"
        value={phone}
        readOnly={phoneReadonly || otpUiState === 'call_to_auth'}
        aria-readonly={phoneReadonly || otpUiState === 'call_to_auth'}
        className={phoneReadonly ? styles.readonly : undefined}
        inputMode="tel"
        onFocus={() => {
          if (!phone) setPhone('+7');
        }}
        onChange={(e) => {
          if (phoneReadonly || otpUiState === 'call_to_auth') return;
          setPhone(formatRuPhone(e.target.value));
        }}
      />

      {otpUiState === 'code' && (
        <input
          placeholder="Код"
          value={code}
          inputMode="numeric"
          onChange={(e) => setCode(e.target.value)}
        />
      )}

      {otpUiState === 'call_to_auth' && (
        <div className={styles.success}>
          <strong>Подтверждение номера</strong>
          <div>Для подтверждения номера позвоните на {callToAuthNumber ?? 'указанный номер'}</div>
          <div>Звонок абсолютно бесплатный.</div>
          <div>После звонка подтверждение произойдёт автоматически.</div>
          {provider && <div>Провайдер: {provider}</div>}
          {otpStatus && <div>Статус: {otpStatus}</div>}
          {typeof expiresInSec === 'number' && <div>Истекает через: {expiresInSec} сек.</div>}
        </div>
      )}

      {purpose === 'buyer_register_phone' && (
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={props.privacyAccepted}
            onChange={(e) => props.onPrivacyAcceptedChange(e.target.checked)}
          />
          <span>
            Я соглашаюсь на{' '}
            <Link to="/privacy-policy" className={styles.policyLink}>
              обработку персональных данных
            </Link>
          </span>
        </label>
      )}

      {otpUiState === 'code' ? (
        <>
          <Button type="submit" disabled={isBusy || !canSubmit}>
            Подтвердить
          </Button>

          <button
            type="button"
            className={styles.resend}
            disabled={isBusy || resendLeft > 0}
            onClick={() => void request()}
          >
            {resendLeft > 0 ? `Отправить ещё раз через ${resendLeft}с` : 'Отправить ещё раз'}
          </button>
        </>
      ) : otpUiState === 'call_to_auth' ? (
        <Button type="button" disabled={isBusy || !requestId} onClick={() => void request()}>
          Запросить звонок повторно
        </Button>
      ) : (
        <Button type="submit" disabled={isBusy || !canSubmit}>
          Получить код
        </Button>
      )}
    </form>
  );
}

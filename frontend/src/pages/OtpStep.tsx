import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import styles from './AuthPage.module.css';

type Purpose = 'login' | 'register' | 'seller_verify';

const RESEND_SECONDS = 30;

const normalizePhone = (v: string) => (v ?? '').replace(/\D/g, '');

// Маска: +7 (___) ___-__-__
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

// На бэк: 7XXXXXXXXXX (11)
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
  onRequestOtp: (p: { phone: string; purpose: Purpose }, token?: string | null) => Promise<void>;
  onVerifyOtp: (p: { phone: string; code: string; purpose: Purpose }, token?: string | null) => Promise<void>;
  onSuccess: () => void;
  setMessage: (v: string) => void;
  setError: (v: string) => void;
}) {
  const { purpose, tempToken, initialPhone } = props;

  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [resendLeft, setResendLeft] = useState(0);

  useEffect(() => {
    setOtpSent(false);
    setOtpLoading(false);
    setCode('');
    setResendLeft(0);
    setPhone(initialPhone ? formatRuPhone(initialPhone) : '');
  }, [purpose, initialPhone]);

  useEffect(() => {
    if (!otpSent) {
      setResendLeft(0);
      return;
    }

    setResendLeft(RESEND_SECONDS);
    const id = window.setInterval(() => setResendLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [otpSent]);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);

  const phoneReadonly = purpose === 'login' && phoneDigits.replace(/^7/, '').length === 10;

  const canSubmit =
    phoneDigits.replace(/^7/, '').length >= 10 &&
    (!otpSent || Boolean(code.trim())) &&
    (purpose !== 'register' || props.privacyAccepted);

  const validateRuPhone = (v11: string) => {
    const ten = v11.slice(1);
    return ten.length === 10 && ten[0] === '9';
  };

  const request = async () => {
    props.setError('');
    props.setMessage('');
    setOtpLoading(true);

    try {
      const v11 = toE164Ru(phone);
      if (!validateRuPhone(v11)) {
        props.setError('Введите номер в формате: +7 (9XX) XXX-XX-XX');
        return;
      }

      await props.onRequestOtp({ phone: v11, purpose }, tempToken);
      setOtpSent(true);
      props.setMessage('Код отправлен. Проверьте SMS.');
    } catch {
      props.setError('Не удалось отправить код.');
    } finally {
      setOtpLoading(false);
    }
  };

  const verify = async () => {
    props.setError('');
    props.setMessage('');
    setOtpLoading(true);

    try {
      const v11 = toE164Ru(phone);
      await props.onVerifyOtp({ phone: v11, code: code.trim(), purpose }, tempToken);
      props.onSuccess();
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message === 'PHONE_MISMATCH'
          ? 'Номер телефона не совпадает с учетной записью.'
          : 'Неверный код или время истекло.';
      props.setError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (otpSent) void verify();
        else void request();
      }}
    >
      <input
        placeholder="+7 (___) ___-__-__"
        value={phone}
        readOnly={phoneReadonly}
        aria-readonly={phoneReadonly}
        className={phoneReadonly ? styles.readonly : undefined}
        inputMode="tel"
        onFocus={() => {
          if (!phone) setPhone('+7');
        }}
        onChange={(e) => {
          if (phoneReadonly) return;
          setPhone(formatRuPhone(e.target.value));
        }}
      />

      {otpSent && (
        <input
          placeholder="Код из SMS"
          value={code}
          inputMode="numeric"
          onChange={(e) => setCode(e.target.value)}
        />
      )}

      {purpose === 'register' && (
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

      <Button type="submit" disabled={otpLoading || !canSubmit}>
        {otpSent ? 'Подтвердить' : 'Отправить код'}
      </Button>

      {otpSent && (
        <button
          type="button"
          className={styles.resend}
          disabled={otpLoading || resendLeft > 0}
          onClick={() => void request()}
        >
          {resendLeft > 0 ? `Отправить ещё раз через ${resendLeft}с` : 'Отправить ещё раз'}
        </button>
      )}
    </form>
  );
}

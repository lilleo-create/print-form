import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { normalizeApiError } from '../shared/api/client';
import styles from './AuthPage.module.css';

import type { OtpFlowType, RegistrationPurpose } from '../shared/api/authApi';

type OtpRequestData = {
  requestId: string;
  verificationType: 'call_to_auth' | 'code';
  callToAuthNumber?: string | null;
  phone?: string;
  status?: string;
  expiresInSec?: number;
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
  purpose?: RegistrationPurpose;
  tempToken: string | null;
  initialPhone?: string;
  flowType?: OtpFlowType;
  title?: string;
  introMessage?: string;
  initialRequest?: OtpRequestData | null;
  hidePhoneInput?: boolean;
  idleMessage?: string;
  onRequestOtp: (p: { phone: string; purpose?: RegistrationPurpose }, token?: string | null) => Promise<OtpRequestData | null>;
  onCheckOtpStatus: (requestId: string, token?: string | null) => Promise<'pending' | 'verified' | 'expired' | 'failed' | 'cancelled'>;
  onVerifyOtp: (p: { phone: string; code?: string; requestId?: string; purpose?: RegistrationPurpose }, token?: string | null) => Promise<void>;
  onSuccess: () => void;
  setMessage: (v: string) => void;
  setError: (v: string) => void;
  onUiStateChange?: (state: OtpUiState) => void;
  onBack?: () => void;
}) {
  const { purpose, tempToken, initialPhone, initialRequest } = props;

  const [otpUiState, setOtpUiState] = useState<OtpUiState>('idle');
  const [phone, setPhone] = useState('');
  const [callToAuthNumber, setCallToAuthNumber] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const autoRequestedRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopPolling();
    setOtpUiState('idle');
    setCallToAuthNumber(initialRequest?.callToAuthNumber ?? null);
    setPhone(initialPhone ? formatRuPhone(initialPhone) : '');
    requestIdRef.current = initialRequest?.requestId ?? null;
    autoRequestedRef.current = Boolean(initialRequest?.requestId);
  }, [initialPhone, initialRequest, purpose, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);

  const validateRuPhone = (v11: string) => {
    const ten = v11.slice(1);
    return ten.length === 10 && ten[0] === '9';
  };

  const beginPolling = useCallback(
    async (requestData: OtpRequestData, verifiedPhone: string) => {
      requestIdRef.current = requestData.requestId;
      setOtpUiState('call_to_auth');
      setCallToAuthNumber(requestData.callToAuthNumber ?? null);
      if (requestData.phone) {
        setPhone(formatRuPhone(requestData.phone));
      }
      props.setMessage(props.introMessage ?? 'Ожидаем автоматическое подтверждение после звонка.');

      stopPolling();
      pollingRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const status = await props.onCheckOtpStatus(requestData.requestId, tempToken);
            if (status === 'verified') {
              stopPolling();
              await props.onVerifyOtp({ phone: verifiedPhone, requestId: requestData.requestId, purpose }, tempToken);
              props.onSuccess();
              return;
            }
            if (status === 'expired' || status === 'failed' || status === 'cancelled') {
              stopPolling();
              requestIdRef.current = null;
              setOtpUiState('error');
              props.setError('Время ожидания звонка истекло. Запросите подтверждение снова.');
            }
          } catch {
            stopPolling();
            requestIdRef.current = null;
            setOtpUiState('error');
            props.setError('Не удалось проверить статус подтверждения.');
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [props, purpose, stopPolling, tempToken]
  );

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

      if (data.verificationType !== 'call_to_auth') {
        setOtpUiState('error');
        props.setError('Не удалось начать подтверждение звонком. Попробуйте ещё раз.');
        return;
      }

      await beginPolling(data, v11);
    } catch (error) {
      const normalized = normalizeApiError(error);
      setOtpUiState('error');
      if (normalized.code === 'OTP_PROVIDER_UNAVAILABLE') {
        props.setError('Не удалось начать подтверждение номера. Попробуйте ещё раз.');
      } else if (normalized.code === 'OTP_TOKEN_REQUIRED') {
        props.setError('Сессия подтверждения истекла. Начните ещё раз.');
      } else if (normalized.status === 429) {
        props.setError('Слишком много запросов. Попробуйте чуть позже.');
      } else {
        props.setError('Не удалось начать подтверждение звонком.');
      }
    }
  }, [beginPolling, phone, props, purpose, tempToken]);

  useEffect(() => {
    if (!initialRequest?.requestId || initialRequest.verificationType !== 'call_to_auth') {
      return;
    }

    const verifiedPhone = toE164Ru(initialRequest.phone ?? phone ?? initialPhone ?? '');
    void beginPolling(initialRequest, verifiedPhone);
  }, [beginPolling, initialPhone, initialRequest, phone]);

  useEffect(() => {
    if (autoRequestedRef.current) return;
    if (phoneDigits.replace(/^7/, '').length < 10) return;

    autoRequestedRef.current = true;
    void request();
  }, [phoneDigits, request]);

  useEffect(() => {
    props.onUiStateChange?.(otpUiState);
  }, [otpUiState, props]);

  const isBusy = otpUiState === 'requesting';
  const callToAuthDisplayNumber = callToAuthNumber ? formatRuPhone(callToAuthNumber) : null;
  const callToAuthTelHref = toTelHref(callToAuthNumber);

  return (
    <div className={styles.form}>
      {otpUiState === 'call_to_auth' && (
        <div className={styles.callToAuthCard}>
          <h2 className={styles.callToAuthTitle}>{props.title ?? 'Подтверждение номера'}</h2>
          <p className={styles.callToAuthSubtitle}>Позвоните на</p>
          <a href={callToAuthTelHref} className={styles.callToAuthPhone}>
            {callToAuthDisplayNumber ?? 'номер недоступен'}
          </a>
          <p className={styles.callToAuthHint}>Звонок бесплатный. После звонка подтверждение завершится автоматически.</p>
        </div>
      )}

      {otpUiState === 'error' && (
        <>
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => void request()}
            variant="secondary"
            className={styles.lightButtonText}
          >
            Запросить звонок повторно
          </Button>
          {props.onBack && (
            <Button type="button" disabled={isBusy} onClick={props.onBack} variant="ghost">
              Назад
            </Button>
          )}
        </>
      )}

      {otpUiState === 'idle' && (
        <p className={styles.subtitle}>
          {props.idleMessage ??
            (props.flowType === 'device_login_verification'
              ? 'Подготавливаем подтверждение входа…'
              : props.flowType === 'password_reset_verification'
                ? 'Подготавливаем подтверждение для восстановления пароля…'
                : 'Подготавливаем подтверждение номера…')}
        </p>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { normalizeApiError } from '../shared/api/client';
import { normalizePhone, toCanonicalRuPhone, formatRuPhone, toTelHref } from '../shared/lib/validation';
import styles from './AuthPage.module.css';

import type { OtpFlowType, OtpVerifyStatus, RegistrationPurpose } from '../shared/api/authApi';

type OtpRequestData = {
  requestId: string;
  verificationType: 'call_to_auth';
  callToAuthNumber?: string | null;
  phone?: string;
  status?: string;
  expiresInSec?: number;
};
type OtpUiState = 'idle' | 'requesting' | 'call_to_auth' | 'error';

const POLL_INTERVAL_MS = 3000;


type ActiveOtpChallenge = {
  flowType: OtpFlowType;
  requestId: string;
  tempToken: string | null;
  challengePhone: string | null;
  callToAuthNumber: string | null;
  originalUserPhone: string | null;
  otpRequest: OtpRequestData;
};

const resolveChallengePhone = (challengePhone?: string | null, fallbackPhone?: string | null) => {
  const normalizedChallengePhone = toCanonicalRuPhone(challengePhone ?? '');
  if (/^\+7\d{10}$/.test(normalizedChallengePhone)) {
    return normalizedChallengePhone;
  }
  return fallbackPhone ? toCanonicalRuPhone(fallbackPhone) : null;
};

export function OtpStep(props: {
  purpose?: RegistrationPurpose | null;
  tempToken: string | null;
  initialPhone?: string;
  flowType?: OtpFlowType;
  title?: string;
  introMessage?: string;
  initialRequest?: OtpRequestData | null;
  hidePhoneInput?: boolean;
  idleMessage?: string;
  onRequestOtp: (p: { phone: string; purpose?: RegistrationPurpose }, token?: string | null) => Promise<{ otpRequest: OtpRequestData | null; tempToken?: string | null }>;
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
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<OtpVerifyStatus>('idle');
  const [now, setNow] = useState(() => Date.now());
  const pollingRef = useRef<number | null>(null);
  const autoRequestedRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  const challengeKeyRef = useRef<string | null>(null);
  const activeTokenRef = useRef<string | null>(tempToken);
  const activeChallengeRef = useRef<ActiveOtpChallenge | null>(null);

  const traceOtp = useCallback((stage: string, challenge: ActiveOtpChallenge | null, details?: Record<string, unknown>) => {
    if (!import.meta.env.DEV) return;
    console.debug('[otp]', stage, {
      flowType: challenge?.flowType ?? props.flowType ?? 'registration',
      requestId: challenge?.requestId ?? null,
      phoneSentInRequest: details?.phoneSentInRequest ?? null,
      phoneSentInVerify: details?.phoneSentInVerify ?? null,
      challengePhone: challenge?.challengePhone ?? null,
      callToAuthNumber: challenge?.callToAuthNumber ?? null,
      originalUserPhone: challenge?.originalUserPhone ?? null,
    });
  }, [props.flowType]);

  const buildActiveChallenge = useCallback((requestData: OtpRequestData, originalPhone?: string | null): ActiveOtpChallenge => ({
    flowType: props.flowType ?? 'registration',
    requestId: requestData.requestId,
    tempToken: activeTokenRef.current,
    challengePhone: resolveChallengePhone(requestData.phone, originalPhone ?? initialPhone ?? ''),
    callToAuthNumber: requestData.callToAuthNumber ?? null,
    originalUserPhone: originalPhone ? toCanonicalRuPhone(originalPhone) : (initialPhone ? toCanonicalRuPhone(initialPhone) : null),
    otpRequest: {
      ...requestData,
      phone: resolveChallengePhone(requestData.phone, originalPhone ?? initialPhone ?? '') ?? requestData.phone,
    },
  }), [initialPhone, props.flowType]);

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
    setResendAvailableAt(initialRequest?.expiresInSec ? Date.now() + initialRequest.expiresInSec * 1000 : null);
    setVerifyStatus(initialRequest?.requestId ? 'pending' : 'idle');
    setPhone(initialPhone ? formatRuPhone(initialPhone) : '');
    requestIdRef.current = initialRequest?.requestId ?? null;
    challengeKeyRef.current = initialRequest?.requestId ? `${props.flowType ?? 'registration'}:${initialRequest.requestId}:${tempToken ?? ''}` : null;
    activeTokenRef.current = tempToken;
    activeChallengeRef.current = initialRequest?.requestId ? buildActiveChallenge(initialRequest, initialPhone ?? null) : null;
    autoRequestedRef.current = Boolean(initialRequest?.requestId);
    traceOtp('init', activeChallengeRef.current);
  }, [buildActiveChallenge, initialPhone, initialRequest, purpose, stopPolling, tempToken, traceOtp, props.flowType]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (!resendAvailableAt || now >= resendAvailableAt) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [now, resendAvailableAt]);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);

  const validateRuPhone = (v11: string) => {
    const ten = v11.slice(1);
    return ten.length === 10 && ten[0] === '9';
  };

  const beginPolling = useCallback(
    async (requestData: OtpRequestData, requestedPhone: string) => {
      const challengeKey = `${props.flowType ?? 'registration'}:${requestData.requestId}:${activeTokenRef.current ?? ''}`;
      const activeChallenge = buildActiveChallenge(requestData, requestedPhone);
      challengeKeyRef.current = challengeKey;
      requestIdRef.current = requestData.requestId;
      activeChallengeRef.current = activeChallenge;
      setOtpUiState('call_to_auth');
      setCallToAuthNumber(requestData.callToAuthNumber ?? null);
      setResendAvailableAt(requestData.expiresInSec ? Date.now() + requestData.expiresInSec * 1000 : null);
      setVerifyStatus('pending');
      if (requestData.phone) {
        setPhone(formatRuPhone(requestData.phone));
      }
      traceOtp('challenge_started', activeChallenge, { phoneSentInRequest: requestedPhone });
      props.setMessage(props.introMessage ?? 'Ожидаем автоматическое подтверждение после звонка.');

      stopPolling();
      pollingRef.current = window.setInterval(() => {
        void (async () => {
          try {
            if (challengeKeyRef.current !== challengeKey) {
              return;
            }
            const status = await props.onCheckOtpStatus(requestData.requestId, activeTokenRef.current);
            setVerifyStatus(status);
            if (status === 'verified') {
              stopPolling();
              const phoneForVerify = activeChallengeRef.current?.challengePhone;
              if (!phoneForVerify) {
                throw new Error('OTP verify phone missing from active challenge');
              }
              traceOtp('verify', activeChallengeRef.current, { phoneSentInVerify: phoneForVerify });
              await props.onVerifyOtp({ phone: phoneForVerify, requestId: requestData.requestId, purpose: purpose ?? undefined }, activeTokenRef.current);
              props.onSuccess();
              return;
            }
            if (status === 'expired' || status === 'failed' || status === 'cancelled') {
              stopPolling();
              requestIdRef.current = null;
              activeChallengeRef.current = null;
              setOtpUiState('error');
              props.setError('Время ожидания звонка истекло. Запросите подтверждение снова.');
            }
          } catch {
            stopPolling();
            setOtpUiState('error');
            setVerifyStatus('error');
            props.setError('Не удалось проверить статус подтверждения.');
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [buildActiveChallenge, props, purpose, stopPolling, traceOtp]
  );

  const request = useCallback(async () => {
    props.setError('');
    props.setMessage('');
    setOtpUiState('requesting');

    try {
      if (resendAvailableAt && Date.now() < resendAvailableAt) {
        props.setError('Повторный запрос пока недоступен. Дождитесь завершения текущего окна подтверждения.');
        setOtpUiState('error');
        return;
      }

      const canonicalPhone = toCanonicalRuPhone(phone);
      const canonicalDigits = normalizePhone(canonicalPhone);
      if (!validateRuPhone(canonicalDigits)) {
        props.setError('Введите номер в формате: +7 (9XX) XXX-XX-XX');
        setOtpUiState('error');
        return;
      }

      traceOtp('request', activeChallengeRef.current, { phoneSentInRequest: canonicalPhone });
      const response = await props.onRequestOtp({ phone: canonicalPhone, purpose: purpose ?? undefined }, activeTokenRef.current);
      const data = response.otpRequest;
      if (!data?.requestId || !data?.verificationType) {
        props.setError('Не удалось начать подтверждение номера. Попробуйте ещё раз.');
        setOtpUiState('error');
        return;
      }
      activeTokenRef.current = response.tempToken ?? activeTokenRef.current;

      if (data.verificationType !== 'call_to_auth') {
        setOtpUiState('error');
        props.setError('Не удалось начать подтверждение звонком. Попробуйте ещё раз.');
        return;
      }

      await beginPolling(data, canonicalPhone);
    } catch (error) {
      const normalized = normalizeApiError(error);
      setOtpUiState('error');
      if (normalized.code === 'OTP_PROVIDER_UNAVAILABLE') {
        props.setError('Не удалось начать подтверждение номера. Попробуйте ещё раз.');
      } else if (normalized.code === 'PHONE_MISMATCH') {
        props.setError('Не удалось подтвердить номер. Повторите запрос подтверждения.');
      } else if (normalized.code === 'OTP_TOKEN_REQUIRED') {
        props.setError('Сессия подтверждения истекла. Начните ещё раз.');
      } else if (normalized.status === 429) {
        setVerifyStatus('pending');
        props.setError('Слишком частые повторы. Используйте текущий активный запрос и попробуйте позже.');
      } else {
        props.setError('Не удалось начать подтверждение звонком.');
      }
    }
  }, [beginPolling, phone, props, purpose, resendAvailableAt]);

  useEffect(() => {
    if (!initialRequest?.requestId || initialRequest.verificationType !== 'call_to_auth') {
      return;
    }

    const challengePhone = resolveChallengePhone(initialRequest.phone, initialPhone || '') ?? toCanonicalRuPhone(initialPhone || '');
    void beginPolling(initialRequest, challengePhone);
  }, [beginPolling, initialPhone, initialRequest]);

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
  const isResendDisabled = isBusy || (resendAvailableAt !== null && now < resendAvailableAt && verifyStatus === 'pending');
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
            disabled={isResendDisabled}
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

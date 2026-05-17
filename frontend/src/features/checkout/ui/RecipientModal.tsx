import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../shared/ui/Button';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import { useBodyScrollLock } from '../../../shared/lib/useBodyScrollLock';
import { useOverlayClose } from '../../../shared/lib/useOverlayClose';
import { useSwipeToClose } from '../../../shared/lib/useSwipeToClose';
import { useAuthStore } from '../../../app/store/authStore';
import { normalizeApiError } from '../../../shared/api/client';
import {
  formatRuPhoneInput,
  isRuPhone,
  toE164Ru,
} from '../../../shared/lib/validation';
import type { CheckoutDto } from '../api/checkoutApi';
import styles from './RecipientModal.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initial: CheckoutDto['recipient'];
  onSave: (data: CheckoutDto['recipient']) => Promise<void>;
};

type OtpMeta = {
  requestId: string;
  callToAuthNumber?: string | null;
};

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#22c55e" fillOpacity="0.15"/>
    <path d="M7.5 12l3 3 6-6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const RecipientModal = ({ isOpen, onClose, initial, onSave }: Props) => {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpMeta, setOtpMeta] = useState<OtpMeta | null>(null);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const checkOtpStatus = useAuthStore((s) => s.checkOtpStatus);

  const focusRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, focusRef);
  useBodyScrollLock(isOpen);
  const { handlePointerDown, handleClick } = useOverlayClose(onClose);
  const { panelRef, handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeToClose(onClose);

  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setStep('form');
      setOtpMeta(null);
      setNameError('');
      setPhoneError('');
      setOtpError('');
    }
  }, [initial, isOpen]);

  const normalizedPhone = toE164Ru(form.phone);
  const phoneChanged = normalizedPhone !== toE164Ru(initial.phone ?? '');

  useEffect(() => {
    if (step !== 'otp' || !otpMeta) return;

    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 3000));
        if (cancelled) break;
        try {
          const status = await checkOtpStatus(otpMeta.requestId);
          if (status === 'verified') {
            try {
              await verifyOtp({
                phone: normalizedPhone,
                requestId: otpMeta.requestId,
                purpose: 'buyer_change_phone',
              });
            } catch {
              // verifyOtp returns void for phone-change flows
            }
            await onSave({ ...form, phone: normalizedPhone });
            onClose();
            break;
          }
          if (status === 'expired' || status === 'failed' || status === 'cancelled') {
            setOtpError('Звонок не прошёл. Запросите его повторно.');
            break;
          }
        } catch {
          break;
        }
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [step, otpMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRequestOtp = async (): Promise<OtpMeta | null> => {
    const result = await requestOtp({ phone: normalizedPhone, purpose: 'buyer_change_phone' });
    if (!result) throw new Error('empty_response');
    return { requestId: result.requestId, callToAuthNumber: result.callToAuthNumber };
  };

  const handleSave = async () => {
    let valid = true;
    if (!form.name.trim()) {
      setNameError('Укажите ФИО получателя');
      valid = false;
    } else {
      setNameError('');
    }
    if (!isRuPhone(form.phone)) {
      setPhoneError('Введите корректный номер телефона');
      valid = false;
    } else {
      setPhoneError('');
    }
    if (!valid) return;

    if (!phoneChanged) {
      setIsBusy(true);
      try {
        await onSave(form);
        onClose();
      } finally {
        setIsBusy(false);
      }
      return;
    }

    setIsBusy(true);
    try {
      const meta = await doRequestOtp();
      setOtpMeta(meta);
      setStep('otp');
    } catch (err) {
      const { code } = normalizeApiError(err);
      if (code === 'OTP_TOKEN_REQUIRED') {
        setPhoneError('Сессия истекла. Обновите страницу и попробуйте снова.');
      } else {
        setPhoneError('Не удалось запустить подтверждение звонком. Попробуйте ещё раз.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetry = async () => {
    setOtpError('');
    setIsRetrying(true);
    try {
      const meta = await doRequestOtp();
      setOtpMeta(meta);
    } catch (err) {
      const { code } = normalizeApiError(err);
      if (code === 'OTP_TOKEN_REQUIRED') {
        setOtpError('Сессия истекла. Вернитесь назад и обновите страницу.');
      } else if (code === 'OTP_COOLDOWN') {
        setOtpError('Подождите немного перед повторным запросом звонка.');
      } else {
        setOtpError('Не удалось повторить звонок. Попробуйте ещё раз.');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={styles.handle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className={styles.handleBar} />
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <div ref={focusRef} className={styles.inner}>
          {step === 'form' ? (
            <>
              <h3 className={styles.title}>Получатель</h3>
              <p className={styles.subtitle}>
                Указывайте реальные данные — при получении заказа могут попросить паспорт
              </p>

              <div className={styles.fields}>
                <label className={`${styles.field} ${nameError ? styles.fieldInvalid : ''}`}>
                  <span className={styles.fieldLabel}>
                    Имя и фамилия <span className={styles.required}>*</span>
                  </span>
                  <div className={styles.fieldRow}>
                    <input
                      className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                      value={form.name}
                      onChange={(e) => { setNameError(''); setForm((p) => ({ ...p, name: e.target.value })); }}
                      placeholder="Иванов Иван Иванович"
                      autoComplete="name"
                    />
                    {form.name.trim() && !nameError && <CheckIcon />}
                  </div>
                  {nameError && <span className={styles.fieldHint}>{nameError}</span>}
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Электронная почта</span>
                  <div className={styles.fieldRow}>
                    <input
                      className={styles.input}
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="example@mail.ru"
                      autoComplete="email"
                      inputMode="email"
                    />
                    {form.email.trim() && <CheckIcon />}
                  </div>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Телефон <span className={styles.required}>*</span>
                  </span>
                  <div className={styles.fieldRow}>
                    <input
                      className={`${styles.input} ${phoneError ? styles.inputError : ''}`}
                      type="tel"
                      value={form.phone}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+7 (___) ___-__-__"
                      onFocus={() => {
                        if (!form.phone) setForm((prev) => ({ ...prev, phone: '+7' }));
                      }}
                      onChange={(e) => {
                        setPhoneError('');
                        setForm((prev) => ({ ...prev, phone: formatRuPhoneInput(e.target.value) }));
                      }}
                    />
                    {form.phone.trim() && !phoneError && <CheckIcon />}
                  </div>
                  {phoneError
                    ? <span className={styles.fieldHint}>{phoneError}</span>
                    : !form.phone.trim() && <span className={styles.fieldHint}>Обязательное поле</span>
                  }
                </label>
              </div>

              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSave()}
                disabled={isBusy || !form.phone.trim() || !form.name.trim()}
              >
                {isBusy ? 'Сохраняем…' : phoneChanged ? 'Далее — подтвердить номер' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => { setStep('form'); setOtpError(''); }}
              >
                ← Назад
              </button>

              {otpMeta?.callToAuthNumber ? (
                /* ── call_to_auth: user calls the number ── */
                <>
                  <h3 className={styles.title}>Позвоните на номер</h3>

                  <a
                    href={`tel:${otpMeta.callToAuthNumber}`}
                    className={styles.callNumber}
                  >
                    {otpMeta.callToAuthNumber}
                  </a>

                  <p className={styles.otpHint}>
                    Позвоните с номера <strong>{normalizedPhone}</strong>.
                    Звонок бесплатный — подтверждение произойдёт автоматически.
                  </p>

                  {otpError ? (
                    <>
                      <span className={styles.error}>{otpError}</span>
                      <Button variant="secondary" onClick={() => void handleRetry()} isLoading={isRetrying}>
                        Получить новый номер
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className={styles.otpSpinner} />
                      <button
                        type="button"
                        className={styles.retryLink}
                        onClick={() => void handleRetry()}
                        disabled={isRetrying}
                      >
                        {isRetrying ? 'Запрашиваем…' : 'Не удалось позвонить? Повторить'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                /* ── incoming call / SMS flow ── */
                <>
                  <h3 className={styles.title}>Подтверждение номера</h3>

                  <p className={styles.otpHint}>
                    Ожидаем входящий звонок на номер <strong>{normalizedPhone}</strong>.
                    Подтверждение произойдёт автоматически.
                  </p>

                  {otpError ? (
                    <>
                      <span className={styles.error}>{otpError}</span>
                      <Button variant="secondary" onClick={() => void handleRetry()} isLoading={isRetrying}>
                        Позвонить снова
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className={styles.otpSpinner} />
                      <button
                        type="button"
                        className={styles.retryLink}
                        onClick={() => void handleRetry()}
                        disabled={isRetrying}
                      >
                        {isRetrying ? 'Запрашиваем…' : 'Не поступил звонок? Повторить'}
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

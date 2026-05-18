import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../../../../app/store/authStore';
import { api } from '../../../../../shared/api';
import { Button } from '../../../../../shared/ui/Button';
import { useBodyScrollLock } from '../../../../../shared/lib/useBodyScrollLock';
import { useOverlayClose } from '../../../../../shared/lib/useOverlayClose';
import { useSwipeToClose } from '../../../../../shared/lib/useSwipeToClose';
import { formatRuPhoneInput, formatRuPhone, toTelHref, isRuPhone, toE164Ru } from '../../../../../shared/lib/validation';
import styles from './ProfileEditModal.module.css';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type PhoneStep = 'view' | 'edit' | 'otp';

export const ProfileEditModal = ({ isOpen, onClose, onSaved }: ProfileEditModalProps) => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const checkOtpStatus = useAuthStore((s) => s.checkOtpStatus);

  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [phoneStep, setPhoneStep] = useState<PhoneStep>('view');
  const [editPhone, setEditPhone] = useState('');
  const [phoneEditError, setPhoneEditError] = useState('');
  const [otpMeta, setOtpMeta] = useState<{ requestId: string; callToAuthNumber?: string | null } | null>(null);
  const [otpError, setOtpError] = useState('');
  const [isOtpBusy, setIsOtpBusy] = useState(false);

  const initialValues = useMemo(
    () => ({
      name: user?.name ?? '',
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    }),
    [user],
  );

  useEffect(() => {
    if (!isOpen) return;
    setName(initialValues.name);
    setFullName(initialValues.fullName);
    setEmail(initialValues.email);
    setPhoneStep('view');
    setPhoneEditError('');
    setOtpError('');
    setOtpMeta(null);
    if (user && !user.phone) {
      api.me().then((res) => {
        const freshPhone = res?.data?.phone;
        if (freshPhone && user) setUser({ ...user, phone: freshPhone });
      }).catch(() => {});
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll OTP status
  useEffect(() => {
    if (phoneStep !== 'otp' || !otpMeta) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 3000));
        if (cancelled) break;
        try {
          const status = await checkOtpStatus(otpMeta.requestId);
          if (status === 'verified') {
            try {
              await verifyOtp({ phone: toE164Ru(editPhone), requestId: otpMeta.requestId, purpose: 'buyer_change_phone' });
            } catch { /* void */ }
            setPhoneStep('view');
            setOtpMeta(null);
            break;
          }
          if (status === 'expired' || status === 'failed' || status === 'cancelled') {
            setOtpError('Звонок не прошёл. Запросите повторно.');
            break;
          }
        } catch { break; }
      }
    };
    void poll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneStep, otpMeta]);

  useBodyScrollLock(isOpen);
  const { handlePointerDown, handleClick } = useOverlayClose(onClose);
  const { panelRef, handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeToClose(onClose);

  if (!isOpen) return null;

  const handleStartEditPhone = () => {
    setEditPhone(initialValues.phone);
    setPhoneEditError('');
    setPhoneStep('edit');
  };

  const handleCancelEditPhone = () => {
    setPhoneStep('view');
    setPhoneEditError('');
    setOtpError('');
    setOtpMeta(null);
  };

  const handleRequestPhoneOtp = async () => {
    if (!isRuPhone(editPhone)) {
      setPhoneEditError('Введите корректный номер телефона');
      return;
    }
    setPhoneEditError('');
    setIsOtpBusy(true);
    try {
      const result = await requestOtp({ phone: toE164Ru(editPhone), purpose: 'buyer_change_phone' });
      if (!result) throw new Error('empty');
      setOtpMeta({ requestId: result.requestId, callToAuthNumber: result.callToAuthNumber });
      setOtpError('');
      setPhoneStep('otp');
    } catch {
      setPhoneEditError('Не удалось запустить подтверждение. Попробуйте ещё раз.');
    } finally {
      setIsOtpBusy(false);
    }
  };

  const handleRetryOtp = async () => {
    setIsOtpBusy(true);
    setOtpError('');
    try {
      const result = await requestOtp({ phone: toE164Ru(editPhone), purpose: 'buyer_change_phone' });
      if (!result) throw new Error('empty');
      setOtpMeta({ requestId: result.requestId, callToAuthNumber: result.callToAuthNumber });
    } catch {
      setOtpError('Не удалось повторить звонок. Попробуйте позже.');
    } finally {
      setIsOtpBusy(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
      });
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onPointerDown={handlePointerDown} onClick={handleClick} role="dialog" aria-modal="true">
      <div ref={panelRef} className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div
          className={styles.handle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className={styles.handleBar} />
        </div>
        <header className={styles.header}>
          <h2>Профиль</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className={styles.photoPlaceholder}>
          <div className={styles.photoCircle} />
          <span>Фото появится позже</span>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            Никнейм
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={styles.field}>
            ФИО
            <input value={fullName} readOnly disabled className={styles.readOnlyInput} />
          </label>
          <label className={styles.field}>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          {/* ── Phone change ── */}
          {phoneStep === 'view' && (
            <div className={styles.phoneViewRow}>
              <label className={`${styles.field} ${styles.phoneFieldGrow}`}>
                Телефон
                <input
                  type="tel"
                  value={initialValues.phone}
                  readOnly
                  disabled
                  className={styles.readOnlyInput}
                />
              </label>
              <button type="button" className={styles.phoneChangeBtn} onClick={handleStartEditPhone}>
                {initialValues.phone ? 'Изменить' : 'Добавить'}
              </button>
            </div>
          )}

          {phoneStep === 'edit' && (
            <label className={styles.field}>
              Новый телефон
              <input
                type="tel"
                placeholder="+7 (___) ___-__-__"
                inputMode="tel"
                autoFocus
                value={editPhone}
                onFocus={() => { if (!editPhone) setEditPhone('+7'); }}
                onChange={(e) => {
                  setPhoneEditError('');
                  setEditPhone(formatRuPhoneInput(e.target.value));
                }}
              />
              {phoneEditError && <span className={styles.fieldError}>{phoneEditError}</span>}
              <div className={styles.phoneEditActions}>
                <Button type="button" variant="secondary" onClick={handleCancelEditPhone}>
                  Отмена
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleRequestPhoneOtp()}
                  isLoading={isOtpBusy}
                  disabled={isOtpBusy}
                >
                  Подтвердить
                </Button>
              </div>
            </label>
          )}

          {phoneStep === 'otp' && otpMeta && (
            <div className={styles.otpBlock}>
              <button type="button" className={styles.otpBackBtn} onClick={handleCancelEditPhone}>
                ← Назад
              </button>
              <p className={styles.otpTitle}>Позвоните на номер</p>
              <a href={toTelHref(otpMeta.callToAuthNumber ?? null)} className={styles.otpCallNumber}>
                {otpMeta.callToAuthNumber ? formatRuPhone(otpMeta.callToAuthNumber) : ''}
              </a>
              <p className={styles.otpHint}>
                Позвоните с номера <strong>{toE164Ru(editPhone)}</strong>.
                Звонок бесплатный — подтверждение автоматически.
              </p>
              {otpError ? (
                <>
                  <span className={styles.fieldError}>{otpError}</span>
                  <Button type="button" variant="secondary" onClick={() => void handleRetryOtp()} isLoading={isOtpBusy}>
                    Получить новый номер
                  </Button>
                </>
              ) : (
                <>
                  <div className={styles.otpSpinner} />
                  <button
                    type="button"
                    className={styles.otpRetryLink}
                    onClick={() => void handleRetryOtp()}
                    disabled={isOtpBusy}
                  >
                    {isOtpBusy ? 'Запрашиваем…' : 'Не удалось позвонить? Повторить'}
                  </button>
                </>
              )}
            </div>
          )}

          {phoneStep !== 'otp' && (
            <div className={styles.actions}>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Сохранение…' : 'Сохранить'}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                Отмена
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

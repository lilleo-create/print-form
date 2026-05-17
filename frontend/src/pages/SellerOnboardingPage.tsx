import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import type { SellerOnboardingPayload } from '../shared/api';
import { Button } from '../shared/ui/Button';
import { useSellerContext } from '../hooks/seller/useSellerContext';
import { Role } from '../shared/types';
import styles from './SellerOnboardingPage.module.css';
import {
  formatRuPhoneInput,
  isRuPhone,
  toE164Ru
} from '../shared/lib/validation';

const steps = ['Контакты', 'Продавец', 'Логистика'] as const;

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
};

const toOptionalString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildSellerOnboardingPayload = (form: {
  name: string;
  phone: string;
  email: string;
  status: 'ИП' | 'ООО' | 'Самозанятый';
  storeName: string;
  city: string;
}): SellerOnboardingPayload => {
  return {
    name: form.name.trim(),
    phone: toE164Ru(form.phone),
    sellerType: form.status,
    city: form.city.trim(),
    email: toOptionalString(form.email),
    storeName: toOptionalString(form.storeName)
  };
};

export const SellerOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const checkOtpStatus = useAuthStore((s) => s.checkOtpStatus);
  const { authStatus, context } = useSellerContext();
  const [step, setStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneVerificationRequired, setPhoneVerificationRequired] =
    useState(false);

  // ── Phone change flow ──
  type PhoneStep = 'view' | 'edit' | 'otp';
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('view');
  const [editPhone, setEditPhone] = useState('');
  const [phoneEditError, setPhoneEditError] = useState('');
  const [otpMeta, setOtpMeta] = useState<{ requestId: string; callToAuthNumber?: string | null } | null>(null);
  const [otpError, setOtpError] = useState('');
  const [isOtpBusy, setIsOtpBusy] = useState(false);

  const handleStartEditPhone = () => {
    setEditPhone(form.phone);
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
      const result = await requestOtp({ phone: toE164Ru(editPhone), purpose: 'seller_connect_phone' });
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
      const result = await requestOtp({ phone: toE164Ru(editPhone), purpose: 'seller_connect_phone' });
      if (!result) throw new Error('empty');
      setOtpMeta({ requestId: result.requestId, callToAuthNumber: result.callToAuthNumber });
    } catch {
      setOtpError('Не удалось повторить звонок. Попробуйте позже.');
    } finally {
      setIsOtpBusy(false);
    }
  };

  // Poll OTP status in 'otp' step
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
              await verifyOtp({ phone: toE164Ru(editPhone), requestId: otpMeta.requestId, purpose: 'seller_connect_phone' });
            } catch { /* void */ }
            setForm((prev) => ({ ...prev, phone: formatRuPhoneInput(editPhone) }));
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
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'ИП' as 'ИП' | 'ООО' | 'Самозанятый',
    storeName: '',
    city: ''
  });
  const sellerProfile = context?.profile ?? null;

  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    status: false,
    storeName: false,
    city: false
  });

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      name: firstNonEmpty(
        sellerProfile?.contactName,
        user.fullName,
        prev.name,
        user.name
      ),
      phone: formatRuPhoneInput(
        firstNonEmpty(
          sellerProfile?.contactPhone,
          sellerProfile?.phone,
          user.phone,
          prev.phone
        )
      ),
      email: firstNonEmpty(sellerProfile?.contactEmail, prev.email, user.email)
    }));
  }, [
    sellerProfile?.contactEmail,
    sellerProfile?.contactName,
    sellerProfile?.contactPhone,
    sellerProfile?.phone,
    user
  ]);

  // Fetch fresh phone from server — stored session may predate phone being set
  useEffect(() => {
    if (!user) return;
    api.me()
      .then((res) => {
        const freshPhone = res?.data?.phone;
        if (freshPhone) {
          setForm((prev) => ({
            ...prev,
            phone: prev.phone || formatRuPhoneInput(freshPhone),
          }));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (authStatus === 'authorized' && sellerProfile) {
      navigate('/seller', { replace: true });
    }
  }, [authStatus, navigate, sellerProfile]);

  useEffect(() => {
    let isMounted = true;
    api
      .getCities()
      .then((citiesResponse) => {
        if (isMounted) {
          setCities(citiesResponse.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCities([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isLoggedIn = Boolean(user);
  const nameValid = form.name.trim().length >= 2;
  const phoneValid = isRuPhone(form.phone);
  const statusValid = form.status.trim().length > 0;
  const storeNameValid = true;
  const cityValid = cities.some((city) => city.name === form.city);

  const canProceed = useMemo(() => {
    if (step === 0) {
      return isLoggedIn && nameValid && phoneValid;
    }
    if (step === 1) {
      return statusValid && storeNameValid;
    }
    if (step === 2) {
      return cityValid;
    }
    return false;
  }, [
    cityValid,
    isLoggedIn,
    nameValid,
    phoneValid,
    statusValid,
    step,
    storeNameValid
  ]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      setPhoneVerificationRequired(false);
      const waitForSellerProfile = async () => {
        const attempts = 5;
        const delayMs = 250;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            const profileResponse = await api.getSellerContext();
            if (profileResponse.data?.profile) {
              return true;
            }
          } catch {
            // ignore and retry
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        return false;
      };
      const response = await api.submitSellerOnboarding(
        buildSellerOnboardingPayload(form)
      );
      const role =
        response.data.role.toLowerCase() === 'seller' ? 'seller' : 'buyer';
      const nextName = response.data.name ?? form.name;
      const nextEmail = response.data.email ?? (form.email.trim() || '');

      setUser({
        id: response.data.id,
        name: nextName,
        fullName: user?.fullName ?? form.name,
        email: nextEmail,
        phone: toE164Ru(response.data.phone ?? form.phone),
        role: role as Role,
        address: user?.address ?? null
      });
      setIsComplete(true);
      await waitForSellerProfile();
      queueMicrotask(() => navigate('/seller', { replace: true }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PHONE_NOT_VERIFIED') {
        setPhoneVerificationRequired(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <section className={styles.page}>
        <div className={styles.onboardingContainer}>
          <div className={styles.completeCard}>
            <h1>Кабинет готов</h1>
            <p>
              Ваш профиль продавца создан. Можно переходить к настройке
              кабинета.
            </p>
            <Button type="button" onClick={() => navigate('/seller')}>
              Перейти в кабинет продавца
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.onboardingContainer}>
        <div className={styles.header}>
          <h1>Подключение продавца</h1>
          <p>Заполните короткую анкету — это займет несколько минут.</p>
        </div>

        <div className={styles.stepper}>
          {steps.map((label, index) => {
            const done    = index < step;
            const active  = index === step;
            const pending = index > step;
            return (
              <div key={label} className={styles.stepItem}>
                {/* connector line before each step except first */}
                {index > 0 && (
                  <span className={`${styles.connector} ${done || active ? styles.connectorDone : ''}`} />
                )}
                <div className={styles.stepDot}>
                  <span className={`${styles.stepNum} ${done ? styles.stepNumDone : active ? styles.stepNumActive : styles.stepNumPending}`}>
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={`${styles.stepLabel} ${pending ? styles.stepLabelPending : ''}`}>
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.card}>
          {phoneVerificationRequired && (
            <div className={styles.notice}>
              <p>Подтвердите номер телефона, чтобы продолжить.</p>
              <Link to="/auth/login?redirectTo=/seller/onboarding">
                Войти и подтвердить телефон
              </Link>
            </div>
          )}
          {step === 0 && (
            <div className={styles.formGrid}>
              <div className={styles.sectionIntro}>
                <h2>Контактные данные</h2>
                <p>Нужны для первого подключения продавца и связи по анкете.</p>
              </div>
              {!isLoggedIn && (
                <div className={styles.notice}>
                  <p>Чтобы продолжить, войдите в аккаунт.</p>
                  <Link to="/auth/login?redirectTo=/seller/onboarding">
                    Войти
                  </Link>
                </div>
              )}
              <label>
                Контактное имя
                <input
                  value={form.name}
                  readOnly
                  disabled
                  className={styles.readOnlyInput}
                />
                {touched.name && !nameValid && (
                  <span className={styles.error}>
                    Введите имя (минимум 2 символа).
                  </span>
                )}
              </label>
              {/* ── Phone field with OTP change flow ── */}
              {phoneStep === 'view' && (
                <div className={styles.phoneViewRow}>
                  <label style={{ flex: 1 }}>
                    Телефон
                    <input
                      value={form.phone}
                      readOnly
                      disabled
                      className={styles.readOnlyInput}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.phoneChangeBtn}
                    onClick={handleStartEditPhone}
                  >
                    Изменить
                  </button>
                </div>
              )}

              {phoneStep === 'edit' && (
                <label>
                  Новый телефон
                  <input
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
                  {phoneEditError && (
                    <span className={styles.error}>{phoneEditError}</span>
                  )}
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
                      Подтвердить номер
                    </Button>
                  </div>
                </label>
              )}

              {phoneStep === 'otp' && otpMeta && (
                <div className={styles.otpBlock}>
                  <button
                    type="button"
                    className={styles.otpBackBtn}
                    onClick={handleCancelEditPhone}
                  >
                    ← Назад
                  </button>
                  <p className={styles.otpTitle}>Позвоните на номер</p>
                  <a
                    href={`tel:${otpMeta.callToAuthNumber}`}
                    className={styles.otpCallNumber}
                  >
                    {otpMeta.callToAuthNumber}
                  </a>
                  <p className={styles.otpHint}>
                    Позвоните с номера <strong>{toE164Ru(editPhone)}</strong>.
                    Звонок бесплатный — подтверждение автоматически.
                  </p>
                  {otpError ? (
                    <>
                      <span className={styles.error}>{otpError}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleRetryOtp()}
                        isLoading={isOtpBusy}
                      >
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
              <label>
                Email (необязательно)
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, email: true }))
                  }
                />
                <span className={styles.helper}>
                  Нужен для доставки и мерчанта. Можно указать в разделе
                  «Подключение».
                </span>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className={styles.formGrid}>
              <div className={styles.sectionIntro}>
                <h2>Данные продавца</h2>
                <p>
                  Оставляем только то, что действительно нужно на первом шаге
                  подключения.
                </p>
              </div>
              <label>
                Статус
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target
                        .value as SellerOnboardingPayload['sellerType']
                    }))
                  }
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, status: true }))
                  }
                >
                  <option value="ИП">ИП</option>
                  <option value="ООО">ООО</option>
                  <option value="Самозанятый">Самозанятый</option>
                </select>
                {touched.status && !statusValid && (
                  <span className={styles.error}>Выберите статус.</span>
                )}
              </label>
              <label>
                Название магазина
                <input
                  placeholder="По умолчанию — ваше имя"
                  value={form.storeName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      storeName: event.target.value
                    }))
                  }
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, storeName: true }))
                  }
                />
                <span className={styles.helper}>
                  Название отображается на витрине. Можно указать позже в
                  разделе «Подключение».
                </span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className={styles.formGrid}>
              <div className={styles.sectionIntro}>
                <h2>Логистика / точка отгрузки</h2>
                <p>
                  Пока фиксируем только базовый город хранения. Детальная точка
                  отгрузки выбирается позже в кабинете.
                </p>
              </div>
              <label>
                Город отгрузки
                <select
                  value={form.city}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                >
                  <option value="" disabled>
                    Выберите город
                  </option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {touched.city && !cityValid && (
                  <span className={styles.error}>
                    Выберите город из списка.
                  </span>
                )}
              </label>
            </div>
          )}

          <div className={styles.actions}>
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep((prev) => prev - 1)}
              >
                Назад
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                disabled={!canProceed}
              >
                Далее
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceed || isSubmitting}
              >
                Завершить
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

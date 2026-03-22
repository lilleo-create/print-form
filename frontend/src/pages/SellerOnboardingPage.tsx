import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import type { SellerOnboardingPayload } from '../shared/api';
import { Button } from '../shared/ui/Button';
import { Role } from '../shared/types';
import styles from './SellerOnboardingPage.module.css';
import {
  formatRuPhoneInput,
  isRuPhone,
  toE164Ru
} from '../shared/lib/validation';

const steps = ['Контакты', 'Продавец', 'Логистика'] as const;
const CONTACT_SUPPORT_TEXT =
  'Для смены контактной информации обратитесь в поддержку';

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
  const [step, setStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneVerificationRequired, setPhoneVerificationRequired] =
    useState(false);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'ИП' as 'ИП' | 'ООО' | 'Самозанятый',
    storeName: '',
    city: ''
  });
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    status: false,
    storeName: false,
    city: false
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: user.fullName?.trim() || prev.name || user.name,
        phone: formatRuPhoneInput(user.phone ?? prev.phone ?? ''),
        email: prev.email || (user.email ?? '')
      }));
    }
  }, [user]);

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
          {steps.map((label, index) => (
            <div
              key={label}
              className={index <= step ? styles.stepActive : styles.step}
            >
              <span>{index + 1}</span>
              <p>{label}</p>
            </div>
          ))}
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
              <label>
                Телефон
                <input
                  placeholder="+7 (___) ___-__-__"
                  inputMode="tel"
                  value={form.phone}
                  readOnly
                  disabled
                  className={styles.readOnlyInput}
                />
                {touched.phone && !phoneValid && (
                  <span className={styles.error}>
                    Введите корректный номер.
                  </span>
                )}
              </label>
              <p className={styles.helper}>{CONTACT_SUPPORT_TEXT}</p>
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

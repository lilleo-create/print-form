import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { useFilters } from '../features/catalog/useFilters';
import { api } from '../shared/api';
import { Button } from '../shared/ui/Button';
import { Role } from '../shared/types';
import styles from './SellerOnboardingPage.module.css';

const steps = ['Контакты', 'Статус', 'Город', 'Категория'] as const;
const cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск', 'Ростов-на-Дону'];
const phonePattern = /^\+?[0-9\s()-]{7,}$/;

export const SellerOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { categories } = useFilters();
  const [step, setStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneVerificationRequired, setPhoneVerificationRequired] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    status: 'ИП',
    storeName: '',
    city: '',
    referenceCategory: '',
    catalogPosition: ''
  });
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    status: false,
    storeName: false,
    city: false,
    referenceCategory: false,
    catalogPosition: false
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name,
        phone: prev.phone || (user.phone ?? '')
      }));
    }
  }, [user]);

  const isLoggedIn = Boolean(user);
  const nameValid = form.name.trim().length >= 2;
  const phoneValid = phonePattern.test(form.phone.trim());
  const statusValid = form.status.trim().length > 0;
  const storeNameValid = form.storeName.trim().length >= 2;
  const cityValid = cities.includes(form.city);
  const referenceCategoryValid = form.referenceCategory.trim().length >= 2;
  const catalogPositionValid = form.catalogPosition.trim().length >= 2;

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
    if (step === 3) {
      return referenceCategoryValid && catalogPositionValid;
    }
    return false;
  }, [
    catalogPositionValid,
    cityValid,
    isLoggedIn,
    nameValid,
    phoneValid,
    referenceCategoryValid,
    statusValid,
    step,
    storeNameValid
  ]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      setPhoneVerificationRequired(false);
      const response = await api.submitSellerOnboarding({
        name: form.name,
        phone: form.phone,
        status: form.status as 'ИП' | 'ООО' | 'Самозанятый',
        storeName: form.storeName,
        city: form.city,
        referenceCategory: form.referenceCategory,
        catalogPosition: form.catalogPosition
      });
      const role = response.data.data.role.toLowerCase() === 'seller' ? 'seller' : 'buyer';
      setUser({
        id: response.data.data.id,
        name: response.data.data.name,
        email: response.data.data.email,
        phone: response.data.data.phone,
        role: role as Role,
        address: user?.address ?? null
      });
      setIsComplete(true);
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
        <div className="container">
          <div className={styles.completeCard}>
            <h1>Кабинет готов</h1>
            <p>Ваш профиль продавца создан. Можно переходить к настройке кабинета.</p>
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
      <div className="container">
        <div className={styles.header}>
          <h1>Подключение продавца</h1>
          <p>Заполните короткую анкету — это займет несколько минут.</p>
        </div>

        <div className={styles.stepper}>
          {steps.map((label, index) => (
            <div key={label} className={index <= step ? styles.stepActive : styles.step}>
              <span>{index + 1}</span>
              <p>{label}</p>
            </div>
          ))}
        </div>

        <div className={styles.card}>
          {phoneVerificationRequired && (
            <div className={styles.notice}>
              <p>Подтвердите номер телефона, чтобы продолжить.</p>
              <Link to="/auth/login?redirectTo=/seller/onboarding">Войти и подтвердить телефон</Link>
            </div>
          )}
          {step === 0 && (
            <div className={styles.formGrid}>
              {!isLoggedIn && (
                <div className={styles.notice}>
                  <p>Чтобы продолжить, войдите в аккаунт.</p>
                  <Link to="/auth/login?redirectTo=/seller/onboarding">Войти</Link>
                </div>
              )}
              <label>
                Контактное имя
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                />
                {touched.name && !nameValid && <span className={styles.error}>Введите имя (минимум 2 символа).</span>}
              </label>
              <label>
                Телефон
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                />
                {touched.phone && !phoneValid && <span className={styles.error}>Введите корректный номер.</span>}
              </label>
            </div>
          )}

          {step === 1 && (
            <div className={styles.formGrid}>
              <label>
                Статус
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, status: true }))}
                >
                  <option value="ИП">ИП</option>
                  <option value="ООО">ООО</option>
                  <option value="Самозанятый">Самозанятый</option>
                </select>
                {touched.status && !statusValid && <span className={styles.error}>Выберите статус.</span>}
              </label>
              <label>
                Название магазина
                <input
                  value={form.storeName}
                  onChange={(event) => setForm((prev) => ({ ...prev, storeName: event.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, storeName: true }))}
                />
                {touched.storeName && !storeNameValid && (
                  <span className={styles.error}>Укажите название магазина.</span>
                )}
                <span className={styles.helper}>
                  Название отображается на витрине. Изменение — через поддержку.
                </span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className={styles.formGrid}>
              <label>
                Город хранения товаров
                <select
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                >
                  <option value="" disabled>
                    Выберите город
                  </option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                {touched.city && !cityValid && <span className={styles.error}>Выберите город из списка.</span>}
              </label>
            </div>
          )}

          {step === 3 && (
            <div className={styles.formGrid}>
              <label>
                Референсная категория
                <select
                  value={form.referenceCategory}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, referenceCategory: event.target.value }))
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, referenceCategory: true }))}
                >
                  <option value="" disabled>
                    Выберите категорию
                  </option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {touched.referenceCategory && !referenceCategoryValid && (
                  <span className={styles.error}>Выберите категорию.</span>
                )}
                <span className={styles.helper}>Позже вы сможете продавать и другие категории.</span>
              </label>
              <label>
                Позиционирование в каталоге
                <input
                  value={form.catalogPosition}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, catalogPosition: event.target.value }))
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, catalogPosition: true }))}
                />
                {touched.catalogPosition && !catalogPositionValid && (
                  <span className={styles.error}>Укажите позиционирование.</span>
                )}
              </label>
            </div>
          )}

          <div className={styles.actions}>
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={() => setStep((prev) => prev - 1)}>
                Назад
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button type="button" onClick={() => setStep((prev) => prev + 1)} disabled={!canProceed}>
                Далее
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={!canProceed || isSubmitting}>
                Завершить
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

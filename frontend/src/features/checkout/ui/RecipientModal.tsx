import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useBodyScrollLock } from '../../../shared/lib/useBodyScrollLock';
import type { CheckoutDto } from '../api/checkoutApi';
import styles from './RecipientModal.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initial: CheckoutDto['recipient'];
  onSave: (data: CheckoutDto['recipient']) => Promise<void>;
};

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#22c55e" fillOpacity="0.15"/>
    <path d="M7.5 12l3 3 6-6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const RecipientModal = ({ isOpen, onClose, initial, onSave }: Props) => {
  const [form, setForm] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) setForm(initial);
  }, [initial, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className={styles.inner}>
          <h3 className={styles.title}>Получатель</h3>
          <p className={styles.subtitle}>
            Указывайте реальные данные — при получении заказа могут попросить паспорт
          </p>

          <div className={styles.fields}>
            {/* Name */}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Имя и фамилия</span>
              <div className={styles.fieldRow}>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Имя и фамилия"
                  autoComplete="name"
                />
                {form.name.trim() && <CheckIcon />}
              </div>
            </label>

            {/* Email */}
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

            {/* Phone — required */}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Телефон <span className={styles.required}>*</span>
              </span>
              <div className={styles.fieldRow}>
                <input
                  className={`${styles.input} ${!form.phone.trim() ? styles.inputError : ''}`}
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+7 000 000-00-00"
                  autoComplete="tel"
                  inputMode="tel"
                />
                {form.phone.trim() && <CheckIcon />}
              </div>
              {!form.phone.trim() && (
                <span className={styles.fieldHint}>Обязательное поле</span>
              )}
            </label>
          </div>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => void handleSave()}
            disabled={isSaving || !form.phone.trim()}
          >
            {isSaving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

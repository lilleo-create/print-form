import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../../../../app/store/authStore';
import { Button } from '../../../../../shared/ui/Button';
import styles from './ProfileEditModal.module.css';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ProfileEditModal = ({ isOpen, onClose, onSaved }: ProfileEditModalProps) => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const initialValues = useMemo(
    () => ({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? ''
    }),
    [user]
  );

  useEffect(() => {
    if (!isOpen) return;
    setName(initialValues.name);
    setEmail(initialValues.email);
    setPhone(initialValues.phone);
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    setIsSaving(true);
    try {
      await updateProfile({
        name: trimmedName || undefined,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined
      });
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
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
            Имя
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={styles.field}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Телефон
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

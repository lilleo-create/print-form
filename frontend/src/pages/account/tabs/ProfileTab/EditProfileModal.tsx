import { useEffect, useMemo, useState } from 'react';
import { User } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { useAuthStore } from '../../../../app/store/authStore';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}

export const EditProfileModal = ({ isOpen, user, onClose }: EditProfileModalProps) => {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const canSave = useMemo(() => name.trim().length > 0 || email.trim().length > 0 || phone.trim().length > 0, [
    name,
    email,
    phone
  ]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>Изменить фото или имя</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span>Имя</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Телефон</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <div className={styles.photoPlaceholder}>
            <strong>Фото</strong>
            <p>Скоро</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSave} isLoading={saving} disabled={!canSave || saving}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
};

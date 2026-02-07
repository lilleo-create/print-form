import { useEffect, useMemo } from 'react';
import { User } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import styles from './ProfileSettingsModal.module.css';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onEdit: () => void;
}

type UserWithAvatar = User & { avatar?: string | null; photo?: string | null; image?: string | null };

const getAvatarText = (user: User | null) => {
  const source = user?.name ?? user?.email ?? 'Пользователь';
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const resolveDisplayName = (user: User | null) => user?.name ?? user?.email ?? 'Пользователь';

const resolveAvatarUrl = (user: User | null) => {
  const userWithAvatar = user as UserWithAvatar | null;
  return resolveImageUrl(userWithAvatar?.avatar ?? userWithAvatar?.photo ?? userWithAvatar?.image ?? null);
};

export const ProfileSettingsModal = ({ isOpen, user, onClose, onEdit }: ProfileSettingsModalProps) => {
  const avatarText = useMemo(() => getAvatarText(user), [user]);
  const displayName = useMemo(() => resolveDisplayName(user), [user]);
  const avatarUrl = useMemo(() => resolveAvatarUrl(user), [user]);

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

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>Настройки</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className={styles.preview}>
          <div className={styles.previewCover} />
          <div className={styles.previewRow}>
            <div className={styles.avatar}>
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : avatarText}
            </div>
            <div className={styles.name}>{displayName}</div>
          </div>
        </div>
        <Button type="button" variant="secondary" className={styles.editButton} onClick={onEdit}>
          Изменить фото или имя
        </Button>
      </div>
    </div>
  );
};

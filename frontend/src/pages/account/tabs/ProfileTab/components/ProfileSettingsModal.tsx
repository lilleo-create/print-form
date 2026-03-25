import { useEffect } from 'react';
import { Button } from '../../../../../shared/ui/Button';
import { useBodyScrollLock } from '../../../../../shared/lib/useBodyScrollLock';
import { useOverlayClose } from '../../../../../shared/lib/useOverlayClose';
import styles from './ProfileSettingsModal.module.css';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}

export const ProfileSettingsModal = ({
  isOpen,
  onClose,
  onEditProfile
}: ProfileSettingsModalProps) => {
  useBodyScrollLock(isOpen);

  const { handlePointerDown, handleClick } = useOverlayClose(onClose);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onPointerDown={handlePointerDown} onClick={handleClick} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <h2>Настройки</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>
        <div className={styles.content}>
          <Button type="button" variant="secondary" className={styles.action} onClick={onEditProfile}>
            Изменить фото или контактные данные
          </Button>
        </div>
      </div>
    </div>
  );
};

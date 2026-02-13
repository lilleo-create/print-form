import { useMemo, useState } from 'react';
import { User } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { ProfileEditModal } from './components/ProfileEditModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import styles from './ProfileTab.module.css';

interface ProfileTabProps {
  user: User | null;
}
interface ProfileHeroCardProps extends ProfileTabProps {
  onOpenSettings: () => void;
}

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

const ProfileHeroCard = ({ user, onOpenSettings }: ProfileHeroCardProps) => {
  const avatarText = useMemo(() => getAvatarText(user), [user]);
  const displayName = useMemo(() => resolveDisplayName(user), [user]);

  return (
    <div className={styles.heroCard}>
      <div className={styles.cover}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.settingsButton}
          onClick={onOpenSettings}
        >
          ⚙️ Настройки профиля
        </Button>
      </div>
      <div className={styles.heroContent}>
        <div className={styles.avatar}>{avatarText}</div>
        <div className={styles.name}>{displayName}</div>
      </div>
    </div>
  );
};

const ProfileActivityPlaceholder = () => (
  <div className={styles.activityCard}>
    <p>Активность появится позже</p>
  </div>
);

export const ProfileTab = ({ user }: ProfileTabProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleCloseSettings = () => setIsSettingsOpen(false);
  const handleOpenEdit = () => {
    setIsEditOpen(true);
  };
  const handleCloseEdit = () => setIsEditOpen(false);
  const handleSavedProfile = () => {
    setIsEditOpen(false);
    setIsSettingsOpen(false);
  };

  return (
    <div className={styles.profileLayout}>
      <ProfileHeroCard user={user} onOpenSettings={handleOpenSettings} />
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onEditProfile={handleOpenEdit}
      />
      <ProfileEditModal isOpen={isEditOpen} onClose={handleCloseEdit} onSaved={handleSavedProfile} />
      <ProfileActivityPlaceholder />
    </div>
  );
};

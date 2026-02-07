import { useMemo, useState } from 'react';
import { User } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { EditProfileModal } from './EditProfileModal';
import styles from './ProfileTab.module.css';

interface ProfileTabProps {
  user: User | null;
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

export const ProfileTab = ({ user }: ProfileTabProps) => {
  const avatarText = useMemo(() => getAvatarText(user), [user]);
  const displayName = useMemo(() => resolveDisplayName(user), [user]);
  const avatarUrl = useMemo(() => resolveAvatarUrl(user), [user]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className={styles.profileLayout}>
      <div className={styles.heroCard}>
        <div className={styles.cover}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.settingsButton}
            onClick={() => setIsSettingsOpen(true)}
          >
            ⚙️ Настройки профиля
          </Button>
        </div>
        <div className={styles.heroContent}>
          <div className={styles.avatar}>
            {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : avatarText}
          </div>
          <div className={styles.name}>{displayName}</div>
        </div>
      </div>

      <div className={styles.activityCard}>
        <p>Активность появится позже</p>
      </div>

      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        user={user}
        onClose={() => setIsSettingsOpen(false)}
        onEdit={() => {
          setIsSettingsOpen(false);
          setIsEditOpen(true);
        }}
      />

      <EditProfileModal isOpen={isEditOpen} user={user} onClose={() => setIsEditOpen(false)} />
    </div>
  );
};

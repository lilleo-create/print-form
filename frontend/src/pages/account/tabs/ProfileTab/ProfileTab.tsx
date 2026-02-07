import { useMemo } from 'react';
import { User } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import styles from './ProfileTab.module.css';

interface ProfileTabProps {
  user: User | null;
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

export const ProfileTab = ({ user }: ProfileTabProps) => {
  const avatarText = useMemo(() => getAvatarText(user), [user]);
  const displayName = useMemo(() => resolveDisplayName(user), [user]);

  return (
    <div className={styles.profileLayout}>
      <div className={styles.heroCard}>
        <div className={styles.cover}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.settingsButton}
            onClick={() => console.log('TODO: open profile settings')}
          >
            ⚙️ Настройки профиля
          </Button>
        </div>
        <div className={styles.heroContent}>
          <div className={styles.avatar}>{avatarText}</div>
          <div className={styles.name}>{displayName}</div>
        </div>
      </div>

      <div className={styles.activityCard}>
        <p>Активность появится позже</p>
      </div>
    </div>
  );
};

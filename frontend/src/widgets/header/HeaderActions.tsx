import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../app/store/authStore';
import { useCartStore } from '../../app/store/cartStore';
import styles from '../layout/Layout.module.css';

interface HeaderActionsProps {
  variant?: 'full' | 'compact';
  onProfileClick?: () => void;
  className?: string;
}

export const HeaderActions = ({
  variant = 'full',
  onProfileClick,
  className
}: HeaderActionsProps) => {
  const cartItems = useCartStore((state) => state.items);
  const user = useAuthStore((state) => state.user);

  const avatarText = useMemo(() => {
    const source = user?.name ?? user?.email ?? 'Пользователь';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }, [user?.email, user?.name]);

  const showExtended = variant === 'full';

  return (
    <div className={`${styles.actions} ${className ?? ''}`}>
      {showExtended && (
        <Link to="/orders" className={styles.actionLink} aria-label="Заказы">
          <span aria-hidden>🧾</span>
        </Link>
      )}
      {showExtended && (
        <Link to="/favorites" className={styles.actionLink} aria-label="Избранное">
          <span aria-hidden>❤</span>
        </Link>
      )}
      <Link to="/cart" className={styles.actionLink}>
        <span aria-hidden>🛒</span>
        <span className={styles.cartCount}>{cartItems.length}</span>
      </Link>
      {user ? (
        <button
          type="button"
          className={styles.avatarButton}
          onClick={onProfileClick}
          aria-label="Открыть меню профиля"
        >
          <span className={styles.avatarCircle}>{avatarText}</span>
        </button>
      ) : (
        <Link to="/auth/login" className={styles.actionLink}>
          <span aria-hidden>👤</span>
          <span>Войти</span>
        </Link>
      )}
    </div>
  );
};

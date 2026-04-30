import { Link } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import styles from './HeaderActions.module.css';

type HeaderActionsProps = {
  onProfileClick: () => void;
  variant?: string;
};

const HeartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
  </svg>
);

const CartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
  </svg>
);

const BellIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
  </svg>
);

export const HeaderActions = ({ onProfileClick }: HeaderActionsProps) => {
  const items = useCartStore((s) => s.items);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={styles.actions}>
      <Link to="/favorites" className={styles.textLink}>
        <HeartIcon /> Избранные
      </Link>
      <Link to="/cart" className={styles.textLink}>
        <CartIcon /> Корзина
        {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
      </Link>
      <button className={styles.iconBtn} title="Уведомления" aria-label="Уведомления">
        <BellIcon />
      </button>
      <button
        type="button"
        className={styles.avatar}
        onClick={onProfileClick}
        aria-label="Профиль"
        title="Профиль"
      >
        АМ
      </button>
    </div>
  );
};

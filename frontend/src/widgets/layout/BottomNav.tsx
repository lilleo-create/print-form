import { Link, useLocation, useSearchParams } from 'react-router-dom';
import styles from './Layout.module.css';

export const BottomNav = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const showBottomNav =
    !location.pathname.startsWith('/seller') &&
    !location.pathname.startsWith('/auth') &&
    !location.pathname.startsWith('/privacy-policy');
  const isFavoritesActive = location.pathname === '/favorites';
  const isReturnsActive =
    location.pathname === '/returns' ||
    (location.pathname === '/account' && searchParams.get('tab') === 'returns');
  const isProfile =
    location.pathname === '/account' &&
    (searchParams.get('tab') === 'profile' || !searchParams.get('tab'));

  if (!showBottomNav) {
    return null;
  }

  return (
    <nav className={styles.bottomNav} aria-label="Основная навигация">
      <Link
        to="/"
        className={`${styles.bottomNavItem} ${location.pathname === '/' ? styles.bottomNavItemActive : ''}`}
      >
        <span aria-hidden>🏠</span>
        <span>Главная</span>
      </Link>
      <Link
        to="/favorites"
        className={`${styles.bottomNavItem} ${isFavoritesActive ? styles.bottomNavItemActive : ''}`}
        aria-label="Избранное"
      >
        <span aria-hidden>❤</span>
        <span>Избранное</span>
      </Link>
      <Link
        to="/returns"
        className={`${styles.bottomNavItem} ${isReturnsActive ? styles.bottomNavItemActive : ''}`}
        aria-label="Возвраты"
      >
        <span aria-hidden>↩️</span>
        <span>Возвраты</span>
      </Link>
      <Link
        to="/orders"
        className={`${styles.bottomNavItem} ${location.pathname === '/orders' ? styles.bottomNavItemActive : ''}`}
      >
        <span aria-hidden>🧾</span>
        <span>Заказы</span>
      </Link>
      <Link
        to="/cart"
        className={`${styles.bottomNavItem} ${location.pathname === '/cart' ? styles.bottomNavItemActive : ''}`}
      >
        <span aria-hidden>🛒</span>
        <span>Корзина</span>
      </Link>
      <Link
        to="/account?tab=profile"
        className={`${styles.bottomNavItem} ${isProfile ? styles.bottomNavItemActive : ''}`}
      >
        <span aria-hidden>👤</span>
        <span>Профиль</span>
      </Link>
    </nav>
  );
};

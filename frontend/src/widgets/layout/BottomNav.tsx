import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../app/store/authStore';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import styles from './Layout.module.css';

export const BottomNav = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const openProfileMenu = useHeaderMenuStore((state) => state.openProfileMenu);
  const showBottomNav =
    !location.pathname.startsWith('/seller') &&
    !location.pathname.startsWith('/auth') &&
    !location.pathname.startsWith('/privacy-policy');
  const isOrdersActive =
    location.pathname === '/orders' ||
    (location.pathname === '/account' &&
      (searchParams.get('tab') === 'orders' || searchParams.get('tab') === 'purchases'));
  const isProfile = location.pathname === '/account' || location.pathname === '/favorites' || location.pathname === '/returns';

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
        to="/catalog"
        className={`${styles.bottomNavItem} ${location.pathname.startsWith('/catalog') ? styles.bottomNavItemActive : ''}`}
      >
        <span aria-hidden>🧩</span>
        <span>Каталог</span>
      </Link>
      <Link
        to="/orders"
        className={`${styles.bottomNavItem} ${isOrdersActive ? styles.bottomNavItemActive : ''}`}
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
      {user ? (
        <button
          type="button"
          className={`${styles.bottomNavItem} ${styles.bottomNavButton} ${isProfile ? styles.bottomNavItemActive : ''}`}
          onClick={openProfileMenu}
          aria-label="Открыть меню профиля"
        >
          <span aria-hidden>👤</span>
          <span>Профиль</span>
        </button>
      ) : (
        <Link
          to="/auth/login"
          className={`${styles.bottomNavItem} ${location.pathname.startsWith('/auth') ? styles.bottomNavItemActive : ''}`}
        >
          <span aria-hidden>👤</span>
          <span>Войти</span>
        </Link>
      )}
    </nav>
  );
};

import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../app/store/authStore';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import styles from './Layout.module.css';

const GridIcon = () => (
  <span className={styles.bottomNavGridIcon} aria-hidden>
    <span />
    <span />
    <span />
    <span />
  </span>
);

const getAvatarText = (name?: string | null, email?: string | null) => {
  const source = name ?? email ?? 'Пользователь';
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

export const BottomNav = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const openProfileMenu = useHeaderMenuStore((state) => state.openProfileMenu);
  const toggleCategoriesMenu = useHeaderMenuStore((state) => state.toggleCategoriesMenu);
  const closeProfileMenu = useHeaderMenuStore((state) => state.closeProfileMenu);
  const closeCategoriesMenu = useHeaderMenuStore((state) => state.closeCategoriesMenu);
  const isCategoriesMenuOpen = useHeaderMenuStore((state) => state.isCategoriesMenuOpen);
  const showBottomNav =
    !location.pathname.startsWith('/seller') &&
    !location.pathname.startsWith('/auth') &&
    !location.pathname.startsWith('/privacy-policy');
  const isOrdersActive =
    location.pathname === '/orders' ||
    (location.pathname === '/account' &&
      (searchParams.get('tab') === 'orders' || searchParams.get('tab') === 'purchases'));
  const isProfile = location.pathname === '/account' || location.pathname === '/favorites' || location.pathname === '/returns';
  const avatarText = getAvatarText(user?.name, user?.email);

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
      <button
        type="button"
        className={`${styles.bottomNavItem} ${styles.bottomNavButton} ${isCategoriesMenuOpen ? styles.bottomNavItemActive : ''}`}
        onClick={() => {
          closeProfileMenu();
          toggleCategoriesMenu();
        }}
        aria-label="Открыть категории"
      >
        <GridIcon />
        <span>Категории</span>
      </button>
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
          onClick={() => {
            closeCategoriesMenu();
            openProfileMenu();
          }}
          aria-label="Открыть меню профиля"
        >
          <span className={`${styles.avatarCircle} ${styles.bottomNavAvatar}`}>{avatarText}</span>
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

import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useAuthStore } from '../../app/store/authStore';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import styles from './Layout.module.css';


const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11z"/>
    <path d="M9 21v-7h6v7"/>
  </svg>
);


const HeartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
  </svg>
);

const CartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
  </svg>
);

const PersonIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

const getAvatarText = (name?: string | null, email?: string | null) => {
  const src = name ?? email ?? '';
  return src.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'АМ';
};

export const BottomNav = ({ forceShow = false, onNavigate }: { forceShow?: boolean; onNavigate?: () => void }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const openProfileMenu = useHeaderMenuStore((s) => s.openProfileMenu);
  const closeCategoriesMenu = useHeaderMenuStore((s) => s.closeCategoriesMenu);

  const show = (forceShow || !location.pathname.startsWith('/seller') || location.pathname === '/seller/onboarding') && !location.pathname.startsWith('/auth');
  if (!show) return null;

  const isHome = location.pathname === '/';
  const isFav = location.pathname === '/favorites';
  const isCart = location.pathname === '/cart';
  const isProfile = location.pathname === '/account' || location.pathname === '/returns';
  const isOrders = location.pathname === '/orders' || (location.pathname === '/account' && (searchParams.get('tab') === 'orders' || searchParams.get('tab') === 'purchases'));

  const item = (active: boolean) =>
    `${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ''}`;

  return (
    <nav className={styles.bottomNav} aria-label="Навигация">
      <Link to="/" className={item(isHome)} onClick={onNavigate}>
        <span className={styles.bottomNavIcon}><HomeIcon /></span>
        <span className={styles.bottomNavLabel}>Главная</span>
      </Link>

      <Link to="/favorites" className={item(isFav)} onClick={onNavigate}>
        <span className={styles.bottomNavIcon}><HeartIcon /></span>
        <span className={styles.bottomNavLabel}>Избранные</span>
      </Link>

      <Link to="/cart" className={item(isCart)} onClick={onNavigate} style={{ position: 'relative' }}>
        <span className={styles.bottomNavIcon} style={{ position: 'relative' }}>
          <CartIcon />
          {cartCount > 0 && (
            <span className={styles.bottomNavBadge}>{cartCount > 9 ? '9+' : cartCount}</span>
          )}
        </span>
        <span className={styles.bottomNavLabel}>Корзина</span>
      </Link>

      {user ? (
        <button
          type="button"
          className={`${item(isProfile || isOrders)} ${styles.bottomNavButton}`}
          onClick={() => { onNavigate?.(); closeCategoriesMenu(); openProfileMenu(); }}
          aria-label="Профиль"
        >
          <span className={`${styles.bottomNavAvatar} ${styles.bottomNavIcon}`}>
            {getAvatarText(user.name, user.email)}
          </span>
          <span className={styles.bottomNavLabel}>Профиль</span>
        </button>
      ) : (
        <Link to="/auth/login" className={item(location.pathname.startsWith('/auth'))} onClick={onNavigate}>
          <span className={styles.bottomNavIcon}><PersonIcon /></span>
          <span className={styles.bottomNavLabel}>Войти</span>
        </Link>
      )}
    </nav>
  );
};

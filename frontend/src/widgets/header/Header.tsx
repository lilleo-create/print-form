import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useAuthStore } from '../../app/store/authStore';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { useThemeStore } from '../../app/store/themeStore';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';
import styles from './Header.module.css';

/* ── Icons ── */
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
  </svg>
);
const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10"/>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
  </svg>
);
const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h2l2.5 11h10l2-8H7"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
  </svg>
);

const getInitials = (name?: string | null, email?: string | null) => {
  const src = name ?? email ?? '';
  return src.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'АМ';
};

/* ── Popular search queries ── */
const POPULAR_QUERIES = [
  'Миниатюры для настольных игр',
  'Декор для дома',
  'Фигурки аниме',
  'Прототипы и детали',
  'Сувениры с логотипом',
  'Украшения 3D-печать',
  'Запчасти для 3D-принтера',
  'Модели автомобилей',
];

/* ── Full-screen search overlay ── */
const SearchOverlay = ({ initialValue, onClose }: { initialValue: string; onClose: () => void }) => {
  const [value, setValue] = useState(initialValue);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (q: string) => {
    if (!q.trim()) return;
    navigate(`/catalog?q=${encodeURIComponent(q.trim())}`);
    onClose();
  };

  return (
    <div className={styles.searchOverlay} onClick={onClose}>
      <div className={styles.searchOverlayBox} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <form
          className={styles.searchOverlayForm}
          onSubmit={(e) => { e.preventDefault(); submit(value); }}
        >
          <span className={styles.searchOverlayIcon}><SearchIcon /></span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Найти модели, материалы, продавцов"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
          />
          {value && (
            <button type="button" className={styles.searchOverlayClear} onClick={() => setValue('')} aria-label="Очистить">
              <CloseIcon />
            </button>
          )}
        </form>

        {/* Popular queries */}
        <div className={styles.searchSuggest}>
          <div className={styles.searchSuggestLabel}>Часто ищут</div>
          {POPULAR_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              className={styles.searchSuggestItem}
              onClick={() => submit(q)}
            >
              <span className={styles.searchSuggestIcon}><SearchIcon /></span>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Mobile header (≤767px) ── */
const MobileHeader = ({ onSearchOpen }: { onSearchOpen: () => void }) => {
  const location = useLocation();
  const currentQuery = new URLSearchParams(location.search).get('q') ?? '';

  return (
    <div className={styles.mobileShell}>
      <Link to="/categories" className={styles.mobileIconBtn} aria-label="Категории">
        <GridIcon />
      </Link>

      <button
        className={styles.mobileSearch}
        onClick={onSearchOpen}
        aria-label="Поиск"
      >
        <span className={styles.mobileSearchIcon}><SearchIcon /></span>
        <span className={styles.mobileSearchText}>
          {currentQuery || 'Найти товары'}
        </span>
      </button>

      <button className={styles.mobileIconBtn} aria-label="Уведомления">
        <BellIcon />
      </button>
    </div>
  );
};

/* ── Desktop header ── */
export const Header = () => {
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const [isSearchOpen, setSearchOpen] = useState(false);

  const openProfileMenu = useHeaderMenuStore((s) => s.openProfileMenu);
  const closeProfileMenu = useHeaderMenuStore((s) => s.closeProfileMenu);
  const closeCategoriesMenu = useHeaderMenuStore((s) => s.closeCategoriesMenu);
  const closeSellerMenu = useHeaderMenuStore((s) => s.closeSellerMenu);

  const isCatalogPage = location.pathname === '/catalog';
  const currentQuery = searchParams.get('q') ?? '';

  const handleCatalogClick = () => {
    closeProfileMenu(); closeCategoriesMenu(); closeSellerMenu();
    if (isCatalogPage) navigate('/');
    else navigate('/catalog');
  };

  const initials = user ? getInitials(user.name, user.email) : null;
  const firstName = user?.name?.split(' ')[0] ?? null;

  return (
    <>
      {/* Mobile header */}
      <MobileHeader onSearchOpen={() => setSearchOpen(true)} />

      {/* Desktop pill */}
      <header className={styles.shell}>
        <nav className={styles.pill} aria-label="Навигация">
          {/* Brand */}
          <Link
            to="/"
            className={`${styles.brand} ${isCatalogPage ? styles.brandInactive : ''}`}
          >
            Print·Form
          </Link>

          {/* Catalog toggle */}
          <button
            className={`${styles.ic} ${isCatalogPage ? styles.icActive : ''}`}
            onClick={handleCatalogClick}
            aria-label={isCatalogPage ? 'На главную' : 'Открыть каталог'}
          >
            {isCatalogPage ? <CloseIcon /> : <MenuIcon />}
          </button>

          {/* Search trigger — opens overlay */}
          <button
            className={styles.searchTrigger}
            onClick={() => setSearchOpen(true)}
            aria-label="Поиск"
          >
            <SearchIcon />
            Найти товар
          </button>

          <span className={styles.divider} aria-hidden="true" />

          <Link to="/favorites" className={styles.ic} aria-label="Избранные">
            <HeartIcon />
          </Link>

          <Link
            to="/cart"
            className={`${styles.ic} ${styles.cartWrap}`}
            aria-label={cartCount > 0 ? `Корзина, ${cartCount} товаров` : 'Корзина'}
          >
            <CartIcon />
            {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
          </Link>

          <button className={styles.ic} aria-label="Уведомления">
            <BellIcon />
          </button>

          <button
            className={styles.ic}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Avatar/profile */}
          <button
            className={`${styles.avatarPill} ${!user ? styles.avatarPillGuest : ''}`}
            onClick={() => openProfileMenu()}
            aria-label={user ? 'Профиль' : 'Войти'}
            title={user?.name ?? 'Войти'}
          >
            {initials && <span className={styles.avatarCircle}>{initials}</span>}
            <span className={styles.avatarName}>{firstName ?? 'Войти'}</span>
          </button>
        </nav>
      </header>

      {/* Search overlay (shared desktop + mobile) */}
      {isSearchOpen && (
        <SearchOverlay
          initialValue={currentQuery}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  );
};

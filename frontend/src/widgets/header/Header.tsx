import { FormEvent, useEffect, useRef, useState } from 'react';
import { useFilters } from '../../features/catalog/useFilters';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useAuthStore } from '../../app/store/authStore';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { ProfileMenu } from '../../shared/layout/ProfileMenu';
import { useIsSeller } from '../../shared/lib/useIsSeller';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';
import styles from './Header.module.css';

/* ---- Icons ---- */
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
    <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
  </svg>
);
const MenuIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M3 12h18M3 18h18"/>
  </svg>
);
const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
  </svg>
);
const CartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
  </svg>
);
const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
  </svg>
);
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
  </svg>
);
const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

const getInitials = (name?: string | null, email?: string | null) => {
  const src = name ?? email ?? '';
  return src.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'АМ';
};

/* ---- Category bar (chips) ---- */
const CategoryBar = ({ hidden }: { hidden: boolean }) => {
  const { categories } = useFilters();
  const [active, setActive] = useState('');
  const navigate = useNavigate();
  const { isSeller, sellerCabinetLink } = useIsSeller();

  return (
    <div className={`${styles.catbar} ${hidden ? styles.catbarHidden : ''}`}>
      <div className={styles.catbarInner}>
        <span className={styles.catbarTitle}>Категории</span>
        <button
          className={active === '' ? styles.chipOn : styles.chip}
          onClick={() => { setActive(''); navigate('/catalog'); }}
        >
          Все
        </button>
        {categories.slice(0, 8).map((cat) => (
          <button
            key={cat}
            className={active === cat ? styles.chipOn : styles.chip}
            onClick={() => { setActive(cat); navigate(`/catalog?category=${encodeURIComponent(cat)}`); }}
          >
            {cat}
          </button>
        ))}
        <Link to={sellerCabinetLink} className={styles.sellLink}>
          {isSeller ? 'Кабинет продавца' : 'Продавайте на PrintForm'} <ArrowIcon />
        </Link>
      </div>
    </div>
  );
};

/* ---- Main Header ---- */
export const Header = () => {
  const mobileCategoriesMenuId = 'mobile-categories-menu';
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [catHidden, setCatHidden] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
  );
  const searchDebounceRef = useRef<number | null>(null);
  const scrollRef = useRef({ lastY: 0, acc: 0, ticking: false });

  const isProfileMenuOpen = useHeaderMenuStore((s) => s.isProfileMenuOpen);
  const isCategoriesMenuOpen = useHeaderMenuStore((s) => s.isCategoriesMenuOpen);
  const isSellerMenuOpen = useHeaderMenuStore((s) => s.isSellerMenuOpen);
  const openProfileMenu = useHeaderMenuStore((s) => s.openProfileMenu);
  const closeProfileMenu = useHeaderMenuStore((s) => s.closeProfileMenu);
  const closeCategoriesMenu = useHeaderMenuStore((s) => s.closeCategoriesMenu);
  const toggleCategoriesMenu = useHeaderMenuStore((s) => s.toggleCategoriesMenu);
  const closeSellerMenu = useHeaderMenuStore((s) => s.closeSellerMenu);
  const toggleSellerMenu = useHeaderMenuStore((s) => s.toggleSellerMenu);
  const isSellerPage = location.pathname.startsWith('/seller');

  useBodyScrollLock(isProfileMenuOpen || isCategoriesMenuOpen || isSellerMenuOpen);

  // Sync search with URL
  useEffect(() => {
    if (location.pathname === '/catalog') {
      setSearchValue(searchParams.get('q') ?? '');
    }
  }, [location.pathname, searchParams]);

  // Theme persistence
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  // Close menus on route change
  useEffect(() => {
    closeProfileMenu(); closeCategoriesMenu(); closeSellerMenu();
  }, [location.pathname, location.search, closeProfileMenu, closeCategoriesMenu, closeSellerMenu]);

  // Esc key
  useEffect(() => {
    if (!isProfileMenuOpen && !isCategoriesMenuOpen && !isSellerMenuOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeProfileMenu(); closeCategoriesMenu(); closeSellerMenu(); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isProfileMenuOpen, isCategoriesMenuOpen, isSellerMenuOpen, closeProfileMenu, closeCategoriesMenu, closeSellerMenu]);

  // Hide categories bar on scroll (home + product pages)
  const hideOnScroll = ['/', '/product'].some((p) => location.pathname === p || location.pathname.startsWith('/product/'));
  useEffect(() => {
    if (!hideOnScroll) { setCatHidden(false); return; }
    const threshold = 12;
    scrollRef.current.lastY = window.scrollY;
    const handleScroll = () => {
      if (scrollRef.current.ticking) return;
      scrollRef.current.ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - scrollRef.current.lastY;
        scrollRef.current.lastY = y;
        scrollRef.current.ticking = false;
        if (Math.abs(delta) < 2) return;
        if (y <= 8) { setCatHidden(false); scrollRef.current.acc = 0; return; }
        scrollRef.current.acc += delta;
        if (scrollRef.current.acc > threshold) { setCatHidden(true); scrollRef.current.acc = 0; }
        else if (scrollRef.current.acc < -threshold) { setCatHidden(false); scrollRef.current.acc = 0; }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll]);

  const handleSearchUpdate = (value: string) => {
    setSearchValue(value);
    if (location.pathname !== '/catalog') return;
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      value.trim() ? params.set('q', value.trim()) : params.delete('q');
      params.delete('page');
      setSearchParams(params, { replace: true });
    }, 350);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    searchValue.trim() ? params.set('q', searchValue.trim()) : params.delete('q');
    if (location.pathname === '/catalog') setSearchParams(params);
    else navigate(`/catalog?${params.toString()}`);
  };

  const handleLogout = () => {
    window.dispatchEvent(new Event('auth:logout'));
    closeProfileMenu();
  };

  const initials = getInitials(user?.name, user?.email);

  return (
    <header className={styles.shell}>
      {/* ── Desktop + tablet row ── */}
      <div className={styles.container}>
        <div className={styles.row}>
          {/* Left */}
          <div className={styles.left}>
            <Link to="/" className={styles.brand}>
              Print<span className={styles.dot} />Form
            </Link>
            <button
              className={styles.catBtn}
              onClick={isSellerPage ? toggleSellerMenu : toggleCategoriesMenu}
              aria-label="Открыть каталог"
            >
              <MenuIcon /> Каталог
            </button>
          </div>

          {/* Center: search */}
          <form className={styles.search} onSubmit={handleSearchSubmit}>
            <button type="submit" className={styles.searchIc} aria-label="Найти">
              <SearchIcon />
            </button>
            <input
              type="search"
              name="q"
              placeholder="Поиск моделей, материалов, продавцов"
              value={searchValue}
              autoComplete="off"
              onChange={(e) => handleSearchUpdate(e.target.value)}
            />
          </form>

          {/* Right */}
          <div className={styles.right}>
            <Link to="/favorites" className={styles.hLink}>
              <HeartIcon /> <span className={styles.hLinkText}>Избранные</span>
            </Link>
            <Link to="/cart" className={styles.hLink}>
              <CartIcon /> <span className={styles.hLinkText}>Корзина</span>
              {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
            </Link>
            <button className={styles.iconBtn} title="Уведомления" aria-label="Уведомления">
              <BellIcon />
            </button>
            <button
              className={styles.iconBtn}
              title="Переключить тему"
              onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
              aria-label="Тема"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className={styles.avatar}
              onClick={() => { closeCategoriesMenu(); openProfileMenu(); }}
              aria-label="Профиль"
              title={user?.name ?? 'Профиль'}
            >
              {initials}
            </button>
          </div>
        </div>
      </div>

      {/* ── Category bar ── */}
      <CategoryBar hidden={catHidden} />

      {/* ── Mobile categories sheet ── */}
      {isCategoriesMenuOpen && (
        <div
          className={styles.mobileOverlay}
          role="dialog"
          aria-modal="true"
          onClick={closeCategoriesMenu}
        >
          <div
            id={mobileCategoriesMenuId}
            className={styles.mobileSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.mobileSheetHead}>
              <div>
                <div className={styles.mobileSheetEyebrow}>Каталог</div>
                <div className={styles.mobileSheetTitle}>Категории</div>
                <div className={styles.mobileSheetSub}>Выберите раздел и перейдите к подборке товаров.</div>
              </div>
              <button className={styles.mobileSheetClose} onClick={closeCategoriesMenu} aria-label="Закрыть">✕</button>
            </div>
            <div className={styles.mobileSheetList}>
              <Link to="/catalog" className={styles.mobileSheetItem} onClick={closeCategoriesMenu}>Все категории</Link>
              {/* categories rendered dynamically by CategoryBar */}
            </div>
          </div>
        </div>
      )}

      <ProfileMenu
        isOpen={isProfileMenuOpen}
        pathname={location.pathname}
        searchTab={searchParams.get('tab')}
        onClose={closeProfileMenu}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
      />
    </header>
  );
};

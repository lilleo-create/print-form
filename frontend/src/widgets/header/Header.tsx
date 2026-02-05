import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useAuthStore } from '../../app/store/authStore';
import { useProductBoardStore } from '../../app/store/productBoardStore';
import { HeaderAddress } from '../../shared/ui/address/HeaderAddress';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import styles from '../layout/Layout.module.css';

export const Header = () => {
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const productBoard = useProductBoardStore((state) => state.product);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [isCategoriesHidden, setIsCategoriesHidden] = useState(false);
  const [categoriesHeight, setCategoriesHeight] = useState(0);
  const [productBoardHeight, setProductBoardHeight] = useState(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const stored = window.localStorage.getItem('theme');
    return stored === 'dark' ? 'dark' : 'light';
  });
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const productBoardRef = useRef<HTMLDivElement | null>(null);
  const scrollStateRef = useRef({ lastY: 0, acc: 0, ticking: false });
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${apiBaseUrl}${url}`;
    return `${apiBaseUrl}/${url}`;
  };

  useEffect(() => {
    if (!user) return;
    if (location.pathname === '/catalog') {
      setSearchValue(searchParams.get('q') ?? '');
    }
  }, [location.pathname, searchParams, user]);

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

  const showCatalogHeader = location.pathname === '/catalog';

  useLayoutEffect(() => {
    if (!categoriesRef.current && !productBoardRef.current) return;
    const updateHeight = () => {
      if (categoriesRef.current) {
        setCategoriesHeight(categoriesRef.current.offsetHeight);
      }
      if (productBoardRef.current) {
        setProductBoardHeight(productBoardRef.current.offsetHeight);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (categoriesRef.current) {
      observer.observe(categoriesRef.current);
    }
    if (productBoardRef.current) {
      observer.observe(productBoardRef.current);
    }
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (!showCatalogHeader) {
      setCategoriesHeight(0);
    }
  }, [showCatalogHeader]);

  const isHome = location.pathname === '/';
  const isProductPage = /^\/product\/[^/]+$/.test(location.pathname);
  const isReviewPage = /^\/product\/[^/]+\/reviews$/.test(location.pathname);
  const hideOnScroll = isHome || isProductPage || isReviewPage;

  useEffect(() => {
    if (!hideOnScroll) {
      setIsCategoriesHidden(false);
      return;
    }
    const threshold = 12;
    scrollStateRef.current.lastY = window.scrollY;
    scrollStateRef.current.acc = 0;
    const handleScroll = () => {
      if (scrollStateRef.current.ticking) return;
      scrollStateRef.current.ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - scrollStateRef.current.lastY;
        scrollStateRef.current.lastY = currentY;
        scrollStateRef.current.ticking = false;
        if (Math.abs(delta) < 2) return;
        if (currentY <= 8) {
          scrollStateRef.current.acc = 0;
          setIsCategoriesHidden(false);
          return;
        }
        scrollStateRef.current.acc += delta;
        if (scrollStateRef.current.acc > threshold) {
          setIsCategoriesHidden(true);
          scrollStateRef.current.acc = 0;
        } else if (scrollStateRef.current.acc < -threshold) {
          setIsCategoriesHidden(false);
          scrollStateRef.current.acc = 0;
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileMenuOpen]);

  const handleSearchUpdate = (value: string) => {
    setSearchValue(value);
    if (location.pathname !== '/catalog') return;
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchValue) {
      params.set('q', searchValue);
    } else {
      params.delete('q');
    }
    if (location.pathname === '/catalog') {
      setSearchParams(params);
    } else {
      navigate(`/catalog?${params.toString()}`);
    }
  };

  const showProductBoard =
    isCategoriesHidden && (isProductPage || isReviewPage) && productBoard;
  const ratingValue = productBoard?.ratingAvg ?? 0;
  const ratingCount = productBoard?.ratingCount ?? 0;
  const categoriesBarHeight = categoriesHeight || productBoardHeight;
  const isSeller = user?.role === 'seller';
  const sellLink = isSeller ? '/seller' : '/seller/onboarding';
  const closeProfileMenu = () => setIsProfileMenuOpen(false);
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:logout'));
    }
    closeProfileMenu();
  };

  return (
    <header className={styles.header}>
      <div className={`${styles.headerInner} ${styles.desktopHeader}`}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            Print Form
          </Link>
          <Link to="/catalog" className={styles.catalogButton}>
            Каталог
          </Link>
        </div>
        <form className={styles.search} onSubmit={handleSearchSubmit}>
          <input
            type="search"
            placeholder="Поиск по товарам"
            value={searchValue}
            onChange={(event) => handleSearchUpdate(event.target.value)}
          />
          <button type="submit" aria-label="Найти">
            🔍
          </button>
        </form>
        <div className={styles.actions}>
          <Link to="/orders" className={styles.actionLink} aria-label="Заказы">
            <span aria-hidden>🧾</span>
          </Link>
          <Link to="/returns" className={styles.actionLink} aria-label="Возвраты">
            <span aria-hidden>↩️</span>
          </Link>
          <Link to="/favorites" className={styles.actionLink} aria-label="Избранное">
            <span aria-hidden>❤</span>
          </Link>
          <Link to="/cart" className={styles.actionLink}>
            <span aria-hidden>🛒</span>
            <span className={styles.cartCount}>{cartItems.length}</span>
          </Link>
          {user ? (
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setIsProfileMenuOpen(true)}
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
      </div>
      <div className={styles.mobileHeader}>
        <div className={styles.mobileTopRow}>
          <div className={styles.mobileAddress}>
            <HeaderAddress variant="compact" />
          </div>
          {user && (
            <button
              type="button"
              className={styles.mobileAvatarButton}
              onClick={() => setIsProfileMenuOpen(true)}
              aria-label="Открыть меню профиля"
            >
              <span className={styles.avatarCircle}>{avatarText}</span>
            </button>
          )}
        </div>
        <div className={styles.mobileSearchRow}>
          <button
            type="button"
            className={styles.mobileBurger}
            onClick={() => navigate('/categories')}
            aria-label="Открыть категории"
          >
            ☰
          </button>
          <form className={styles.mobileSearch} onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Найти товары"
              value={searchValue}
              onChange={(event) => handleSearchUpdate(event.target.value)}
            />
            <button type="submit" aria-label="Найти">
              🔍
            </button>
          </form>
        </div>
      </div>
      <div
        className={`${styles.categoriesWrap} ${isCategoriesHidden ? styles.categoriesWrapHidden : ''}`}
        style={{ maxHeight: `${isCategoriesHidden ? 0 : categoriesBarHeight}px` }}
      >
        <div className={styles.categoriesBar}>
          <div className={styles.categoriesSurface}>
            {showCatalogHeader && (
              <div
                ref={categoriesRef}
                className={`${styles.categoriesInner} ${isCategoriesHidden ? styles.categoriesInnerHidden : ''}`}
              >
                <div className={styles.categoriesMeta}>
                  <div className={styles.categoriesTitle}>Категории</div>
                  <div className={styles.categoriesAddress}>
                    <HeaderAddress variant="compact" />
                  </div>
                </div>
                <div id="catalog-category-buttons" />
                <Link to={sellLink} className={styles.sellCta}>
                  {isSeller ? 'Кабинет продавца' : 'Продавайте на PrintForm'}
                </Link>
              </div>
            )}
            <div
              ref={productBoardRef}
              className={`${styles.productBoard} ${showProductBoard ? styles.productBoardVisible : ''}`}
            >
              {productBoard && (
                <>
                  <div className={styles.productBoardInfo}>
                    <img
                      src={resolveImageUrl(productBoard.image)}
                      alt={productBoard.title}
                    />
                    <div>
                      <h4>{productBoard.title}</h4>
                      <div className={styles.productBoardRating}>
                        <Rating value={ratingValue} count={ratingCount} size="sm" />
                        <span>{ratingValue.toFixed(1)}</span>
                        <span>{ratingCount} оценок</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.productBoardActions}>
                    <Button
                      onClick={() => {
                        if (!productBoard) return;
                        addItem(productBoard, 1);
                        navigate('/checkout');
                      }}
                    >
                      Купить сейчас
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!productBoard) return;
                        addItem(productBoard, 1);
                      }}
                    >
                      В корзину
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {isProfileMenuOpen && (
        <div
          className={styles.profileMenuOverlay}
          role="dialog"
          aria-modal="true"
          onClick={closeProfileMenu}
        >
          <div
            className={styles.profileMenuPage}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.profileMenuHeader}>
              <span>Меню</span>
              <button
                type="button"
                className={styles.profileMenuClose}
                onClick={closeProfileMenu}
                aria-label="Закрыть меню"
              >
                ✕
              </button>
            </div>
            <nav className={styles.profileMenuList}>
              <Link to="/orders" className={styles.profileMenuItem} onClick={closeProfileMenu}>
                Заказы
              </Link>
              <Link
                to="/account?tab=purchases"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Купленные товары
              </Link>
              <Link to="/account?tab=returns" className={styles.profileMenuItem} onClick={closeProfileMenu}>
                Возвраты
              </Link>
              <Link to="/favorites" className={styles.profileMenuItem} onClick={closeProfileMenu}>
                Избранные
              </Link>
              <button
                type="button"
                className={`${styles.profileMenuItem} ${styles.profileMenuToggle}`}
                onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              >
                <span>Тема оформления</span>
                <span className={styles.profileMenuToggleValue}>
                  {theme === 'light' ? 'Светлая' : 'Тёмная'}
                </span>
              </button>
              <Link to={sellLink} className={styles.profileMenuItem} onClick={closeProfileMenu}>
                Продавайте на PrintForm
              </Link>
              <Link to="/account?tab=chats" className={styles.profileMenuItem} onClick={closeProfileMenu}>
                Чаты (наше с поддержкой и продавцом)
              </Link>
              <Link to="/privacy-policy" className={styles.profileMenuItem} onClick={closeProfileMenu}>
                О сервисе
              </Link>
              <button
                type="button"
                className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`}
                onClick={handleLogout}
              >
                Выйти
              </button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

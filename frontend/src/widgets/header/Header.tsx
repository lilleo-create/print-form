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
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { HeaderAddress } from '../../shared/ui/address/HeaderAddress';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import { HeaderActions } from './HeaderActions';
import { ProfileMenu } from '../../shared/layout/ProfileMenu';
import { useIsSeller } from '../../shared/lib/useIsSeller';
import styles from '../layout/Layout.module.css';

export const Header = () => {
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
  const isProfileMenuOpen = useHeaderMenuStore((state) => state.isProfileMenuOpen);
  const openProfileMenu = useHeaderMenuStore((state) => state.openProfileMenu);
  const closeProfileMenu = useHeaderMenuStore((state) => state.closeProfileMenu);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const stored = window.localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
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
const CONTENT_MAX = 1120; // твоя max-width контейнера
const SIDE_PAD = 16;

useEffect(() => {
  if (!isProfileMenuOpen) return;

  const updateGutter = () => {
    const w = window.innerWidth;
    const containerWidth = Math.min(CONTENT_MAX, w);
    const gutter =
      Math.max(SIDE_PAD, Math.floor((w - containerWidth) / 2) - SIDE_PAD);

    document.documentElement.style.setProperty(
      '--container-gutter',
      `${gutter}px`
    );
  };

  updateGutter();
  window.addEventListener('resize', updateGutter);
  return () => window.removeEventListener('resize', updateGutter);
}, [isProfileMenuOpen]);
const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
const openProfileMenuHandler = () => {
  if (isMobile) return;
  openProfileMenu();
};
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

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProfileMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

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
    closeProfileMenu();
  }, [closeProfileMenu, location.pathname, location.search]);

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
  const { isSeller, sellerCabinetLink: sellLink } = useIsSeller();
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
            3D Market
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
        <HeaderActions onProfileClick={openProfileMenuHandler} />
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
              onClick={openProfileMenuHandler}
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
      <ProfileMenu
        isOpen={isProfileMenuOpen}
        pathname={location.pathname}
        searchTab={searchParams.get('tab')}
        onClose={closeProfileMenu}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      />

    </header>
  );
};

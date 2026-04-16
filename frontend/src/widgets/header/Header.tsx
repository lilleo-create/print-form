import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFilters } from '../../features/catalog/useFilters';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useBuyNowStore } from '../../app/store/buyNowStore';
import { useAuthStore } from '../../app/store/authStore';
import { useProductBoardStore } from '../../app/store/productBoardStore';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import { HeaderActions } from './HeaderActions';
import { ProfileMenu } from '../../shared/layout/ProfileMenu';
import { useIsSeller } from '../../shared/lib/useIsSeller';
import styles from '../layout/Layout.module.css';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';
import { resolveMediaUrl } from '../../shared/lib/resolveMediaUrl';
import { getProductRatingMeta } from '../../shared/lib/productRating';

export const Header = () => {
  const mobileCategoriesMenuId = 'mobile-categories-menu';
  const addItem = useCartStore((state) => state.addItem);
  const startBuyNow = useBuyNowStore((state) => state.start);
  const user = useAuthStore((state) => state.user);
  const productBoard = useProductBoardStore((state) => state.product);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [isCategoriesHidden, setIsCategoriesHidden] = useState(false);
  const [categoriesHeight, setCategoriesHeight] = useState(0);
  const [productBoardHeight, setProductBoardHeight] = useState(0);
  const isProfileMenuOpen = useHeaderMenuStore(
    (state) => state.isProfileMenuOpen
  );
  const isSellerMenuOpen = useHeaderMenuStore(
    (state) => state.isSellerMenuOpen
  );
  const isCategoriesMenuOpen = useHeaderMenuStore(
    (state) => state.isCategoriesMenuOpen
  );
  const openProfileMenu = useHeaderMenuStore((state) => state.openProfileMenu);
  const closeProfileMenu = useHeaderMenuStore(
    (state) => state.closeProfileMenu
  );
  const closeSellerMenu = useHeaderMenuStore((state) => state.closeSellerMenu);
  const toggleSellerMenu = useHeaderMenuStore(
    (state) => state.toggleSellerMenu
  );
  const closeCategoriesMenu = useHeaderMenuStore(
    (state) => state.closeCategoriesMenu
  );
  const toggleCategoriesMenu = useHeaderMenuStore(
    (state) => state.toggleCategoriesMenu
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const stored = window.localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const mobileCategoriesRef = useRef<HTMLDivElement | null>(null);
  const productBoardRef = useRef<HTMLDivElement | null>(null);
  const scrollStateRef = useRef({ lastY: 0, acc: 0, ticking: false });
  const searchDebounceRef = useRef<number | null>(null);
  const { categories } = useFilters();

  useEffect(() => {
    if (!user) return;
    if (location.pathname === '/catalog') {
      setSearchValue(searchParams.get('q') ?? '');
    }
  }, [location.pathname, searchParams, user]);

  const showCatalogHeader = location.pathname === '/catalog';
  const CONTENT_MAX = 1120; // твоя max-width контейнера
  const SIDE_PAD = 16;

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const updateGutter = () => {
      const w = window.innerWidth;
      const containerWidth = Math.min(CONTENT_MAX, w);
      const gutter = Math.max(
        SIDE_PAD,
        Math.floor((w - containerWidth) / 2) - SIDE_PAD
      );

      document.documentElement.style.setProperty(
        '--container-gutter',
        `${gutter}px`
      );
    };

    updateGutter();
    window.addEventListener('resize', updateGutter);
    return () => window.removeEventListener('resize', updateGutter);
  }, [isProfileMenuOpen]);
  const openProfileMenuHandler = () => {
    closeCategoriesMenu();
    openProfileMenu();
  };

  const isSellerPage = location.pathname.startsWith('/seller');

  const toggleCategoriesMenuHandler = () => {
    closeProfileMenu();
    toggleCategoriesMenu();
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
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
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

  useBodyScrollLock(
    isProfileMenuOpen || isCategoriesMenuOpen || isSellerMenuOpen
  );

  useEffect(() => {
    if (!isProfileMenuOpen && !isCategoriesMenuOpen && !isSellerMenuOpen)
      return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProfileMenu();
        closeCategoriesMenu();
        closeSellerMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    closeCategoriesMenu,
    closeProfileMenu,
    closeSellerMenu,
    isCategoriesMenuOpen,
    isProfileMenuOpen,
    isSellerMenuOpen
  ]);

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
    closeCategoriesMenu();
    closeSellerMenu();
  }, [
    closeCategoriesMenu,
    closeProfileMenu,
    closeSellerMenu,
    location.pathname,
    location.search
  ]);

  const handleSearchUpdate = (value: string) => {
    setSearchValue(value);
    if (location.pathname !== '/catalog') return;

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      params.delete('page');
      setSearchParams(params, { replace: true });
    }, 350);
  };

  useEffect(() => () => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
  }, []);

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
  const ratingMeta = getProductRatingMeta({
    ratingAvg: productBoard?.ratingAvg,
    ratingCount: productBoard?.ratingCount
  });
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
            Print-Form
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
        <div className={styles.mobileSearchRow}>
          <button
            type="button"
            className={styles.mobileBurger}
            onClick={
              isSellerPage ? toggleSellerMenu : toggleCategoriesMenuHandler
            }
            aria-label={
              isSellerPage
                ? isSellerMenuOpen
                  ? 'Закрыть меню продавца'
                  : 'Открыть меню продавца'
                : isCategoriesMenuOpen
                  ? 'Закрыть категории'
                  : 'Открыть категории'
            }
            aria-expanded={
              isSellerPage ? isSellerMenuOpen : isCategoriesMenuOpen
            }
            aria-controls={
              isSellerPage ? 'seller-sidebar' : mobileCategoriesMenuId
            }
          >
            {isSellerPage ? (
              '☰'
            ) : (
              <span className={styles.mobileGridIcon} aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </span>
            )}
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
        style={{
          maxHeight: `${isCategoriesHidden ? 0 : categoriesBarHeight}px`
        }}
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
                      src={resolveMediaUrl(productBoard.image) ?? ''}
                      alt={productBoard.title}
                    />
                    <div>
                      <h4>{productBoard.title}</h4>
                      <div className={styles.productBoardRating}>
                        {ratingMeta.hasReviews ? (
                          <>
                            <Rating
                              value={ratingMeta.ratingValue}
                              count={ratingMeta.ratingCount}
                              size="sm"
                            />
                            <span>{ratingMeta.ratingValue.toFixed(1)}</span>
                            <span>{ratingMeta.ratingCount} оценок</span>
                          </>
                        ) : (
                          <span>Пока нет отзывов</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.productBoardActions}>
                    <Button
                      onClick={() => {
                        if (!productBoard) return;
                        startBuyNow(productBoard, 1);
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

      {isCategoriesMenuOpen && (
        <div
          className={styles.mobileCategoriesOverlay}
          role="dialog"
          aria-modal="true"
          onClick={closeCategoriesMenu}
        >
          <div
            id={mobileCategoriesMenuId}
            className={styles.mobileCategoriesSheet}
            ref={mobileCategoriesRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.mobileCategoriesHeader}>
              <div className={styles.mobileCategoriesTitleGroup}>
                <span className={styles.mobileCategoriesEyebrow}>Каталог</span>
                <span className={styles.mobileCategoriesTitle}>Категории</span>
                <span className={styles.mobileCategoriesSubtitle}>
                  Выберите раздел и перейдите к подборке товаров.
                </span>
              </div>
              <button
                type="button"
                className={styles.mobileCategoriesClose}
                onClick={closeCategoriesMenu}
                aria-label="Закрыть категории"
              >
                ✕
              </button>
            </div>
            <div className={styles.mobileCategoriesList}>
              <Link
                to="/catalog"
                className={styles.mobileCategoryItem}
                onClick={closeCategoriesMenu}
              >
                <span>Все категории</span>
              </Link>
              {categories.map((category) => (
                <Link
                  key={category}
                  to={`/catalog?category=${encodeURIComponent(category)}`}
                  className={styles.mobileCategoryItem}
                  onClick={closeCategoriesMenu}
                >
                  <span>{category}</span>
                </Link>
              ))}
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
        onToggleTheme={() =>
          setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
        }
      />
    </header>
  );
};

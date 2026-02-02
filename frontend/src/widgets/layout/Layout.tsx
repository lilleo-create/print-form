import {
  FormEvent,
  ReactNode,
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
import { useAddressStore } from '../../app/store/addressStore';
import { useProductBoardStore } from '../../app/store/productBoardStore';
import { AddressModal } from '../../shared/ui/address/AddressModal';
import { HeaderAddress } from '../../shared/ui/address/HeaderAddress';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import { ProductModal } from '../shop/ProductModal';
import { useFilters } from '../../features/catalog/useFilters';
import { useCatalog } from '../../features/catalog/useCatalog';
import { api } from '../../shared/api';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const { user, logout } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const addresses = useAddressStore((state) => state.addresses);
  const selectedAddressId = useAddressStore((state) => state.selectedAddressId);
  const isModalOpen = useAddressStore((state) => state.isModalOpen);
  const loadAddresses = useAddressStore((state) => state.loadAddresses);
  const selectAddress = useAddressStore((state) => state.selectAddress);
  const addAddress = useAddressStore((state) => state.addAddress);
  const updateAddress = useAddressStore((state) => state.updateAddress);
  const removeAddress = useAddressStore((state) => state.removeAddress);
  const closeModal = useAddressStore((state) => state.closeModal);
  const resetAddresses = useAddressStore((state) => state.reset);
  const productBoard = useProductBoardStore((state) => state.product);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filterData = useFilters();
  const catalogParams = useMemo(() => ({ limit: 12 }), []);
  const { products } = useCatalog(catalogParams);
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
  const [sellerProfile, setSellerProfile] = useState<{
    isSeller: boolean;
    profile: {
      id: string;
      status: string;
      storeName: string;
      city: string;
      referenceCategory: string;
      catalogPosition: string;
      phone: string;
    } | null;
    kyc?: {
      status: string;
    } | null;
  } | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const productBoardRef = useRef<HTMLDivElement | null>(null);
  const scrollStateRef = useRef({ lastY: 0, acc: 0, ticking: false });
  const token = useAuthStore((s) => s.token);
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${apiBaseUrl}${url}`;
    return `${apiBaseUrl}/${url}`;
  };

  useEffect(() => {
    if (user && token) {
      const controller = new AbortController();
      loadAddresses(user.id, controller.signal);
      return () => controller.abort();
    } else {
      resetAddresses();
    }
  }, [loadAddresses, resetAddresses, token, user]);

  useEffect(() => {
    if (location.pathname === '/catalog') {
      setSearchValue(searchParams.get('q') ?? '');
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (!user || !token) {
      setSellerProfile(null);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    api
      .getSellerContext(controller.signal)
      .then((response) => {
        if (!cancelled) setSellerProfile(response.data);
      })
      .catch((e: any) => {
        if (cancelled) return;

        // 401 = просто не авторизован, не надо паниковать
        if (e?.status === 401) {
          setSellerProfile(null);
          return;
        }

        // 429 = нас порезал лимитер, чтобы не повторять/не плодить запросы
        if (e?.status === 429) {
          setSellerProfile(null);
          return;
        }

        setSellerProfile({ isSeller: false, profile: null });
      });

    return () => {
      controller.abort();
      isMounted = false;
    };
  }, [token, user]);

  const categories = useMemo(() => {
    if (filterData.categories.length) {
      return filterData.categories;
    }
    return Array.from(
      new Set(products.map((product) => product.category))
    ).filter(Boolean);
  }, [filterData.categories, products]);

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

  useLayoutEffect(() => {
    if (!categoriesRef.current) return;
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
    observer.observe(categoriesRef.current);
    if (productBoardRef.current) {
      observer.observe(productBoardRef.current);
    }
    return () => observer.disconnect();
  }, [location.pathname]);

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

  const handleCategorySelect = (category?: string) => {
    const params = new URLSearchParams(searchParams);
    if (category) {
      params.set('category', category);
    } else {
      params.delete('category');
    }
    if (location.pathname === '/catalog') {
      setSearchParams(params);
    } else {
      navigate(`/catalog?${params.toString()}`);
    }
  };

  const activeCategory = searchParams.get('category') ?? '';
  const showProductBoard =
    isCategoriesHidden && (isProductPage || isReviewPage) && productBoard;
  const ratingValue = productBoard?.ratingAvg ?? 0;
  const ratingCount = productBoard?.ratingCount ?? 0;
  const categoriesBarHeight = categoriesHeight || productBoardHeight;
  const isSeller = sellerProfile?.isSeller ?? false;
  const showBottomNav =
    !location.pathname.startsWith('/seller') &&
    !location.pathname.startsWith('/auth') &&
    !location.pathname.startsWith('/privacy-policy');
  const isFavoritesActive = location.pathname === '/favorites';
  const isProfile =
    location.pathname === '/account' &&
    (searchParams.get('tab') === 'profile' || !searchParams.get('tab'));
  const sellLink = isSeller ? '/seller' : '/seller/onboarding';
  const closeProfileMenu = () => setIsProfileMenuOpen(false);

  return (
    <div className={styles.app}>
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
          <div className={styles.actions}>
            <Link
              to="/orders"
              className={styles.actionLink}
              aria-label="Заказы"
            >
              <span aria-hidden>🧾</span>
            </Link>
            <Link
              to="/returns"
              className={styles.actionLink}
              aria-label="Возвраты"
            >
              <span aria-hidden>↩️</span>
            </Link>
            <Link
              to="/favorites"
              className={styles.actionLink}
              aria-label="Избранное"
            >
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
          style={{
            maxHeight: `${isCategoriesHidden ? 0 : categoriesBarHeight}px`
          }}
        >
          <div className={styles.categoriesBar}>
            <div className={styles.categoriesSurface}>
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
                <button
                  type="button"
                  className={
                    !activeCategory
                      ? styles.categoryActive
                      : styles.categoryButton
                  }
                  onClick={() => handleCategorySelect('')}
                >
                  Все категории
                </button>
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={
                      activeCategory === category
                        ? styles.categoryActive
                        : styles.categoryButton
                    }
                    onClick={() => handleCategorySelect(category)}
                  >
                    {category}
                  </button>
                ))}
                {isSeller ? (
                  <Link to="/seller" className={styles.sellCta}>
                    Кабинет продавца
                  </Link>
                ) : (
                  <Link to="/seller/onboarding" className={styles.sellCta}>
                    Продавайте на PrintForm
                  </Link>
                )}
              </div>
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
                          <Rating
                            value={ratingValue}
                            count={ratingCount}
                            size="sm"
                          />
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
      </header>
      <main className={styles.main}>{children}</main>
      {showBottomNav && (
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
            className={`${styles.bottomNavItem} ${location.pathname === '/returns' ? styles.bottomNavItemActive : ''}`}
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
      )}
      <footer className={styles.footer}>
        <div>
          <h4>3D Печать маркетплейс</h4>
          <p>Сервис изготовления, покупки и кастомной печати моделей.</p>
        </div>
        <div>
          <h5>Контакты</h5>
          <p>support@3dmarket.ru</p>
          <p>+7 (800) 555-15-15</p>
        </div>
        <div>
          <h5>Сервисы</h5>
          <p>Каталог</p>
          <p>Кастомная печать</p>
          <p>Личный кабинет</p>
        </div>
      </footer>
      <ProductModal />
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
              <Link
                to="/orders"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Заказы
              </Link>
              <Link
                to="/account?tab=purchases"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Купленный товар
              </Link>
              <Link
                to="/returns"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Возвраты
              </Link>
              <Link
                to="/favorites"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Избранные
              </Link>
              <button
                type="button"
                className={`${styles.profileMenuItem} ${styles.profileMenuToggle}`}
                onClick={() =>
                  setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
                }
              >
                <span>Тема оформления</span>
                <span className={styles.profileMenuToggleValue}>
                  {theme === 'light' ? 'Светлая' : 'Тёмная'}
                </span>
              </button>
              <Link
                to={sellLink}
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Продавайте на PrintForm
              </Link>
              <Link
                to="/account?tab=chats"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                Чаты (наше с поддержкой и продавцом)
              </Link>
              <Link
                to="/privacy-policy"
                className={styles.profileMenuItem}
                onClick={closeProfileMenu}
              >
                О сервисе
              </Link>
              <button
                type="button"
                className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`}
                onClick={() => {
                  logout();
                  closeProfileMenu();
                }}
              >
                Выйти
              </button>
            </nav>
          </div>
        </div>
      )}
      {user && (
        <AddressModal
          isOpen={isModalOpen}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          userId={user.id}
          onClose={closeModal}
          onSelect={(addressId) => selectAddress(user.id, addressId)}
          onCreate={async (payload) => {
            const created = await addAddress(payload);
            await selectAddress(user.id, created.id);
            return created;
          }}
          onUpdate={updateAddress}
          onDelete={async (addressId) => {
            const nextAddresses = addresses.filter(
              (address) => address.id !== addressId
            );
            await removeAddress(user.id, addressId);
            if (selectedAddressId === addressId) {
              const fallbackId = nextAddresses[0]?.id ?? '';
              if (fallbackId) {
                await selectAddress(user.id, fallbackId);
              }
            }
          }}
        />
      )}
    </div>
  );
};

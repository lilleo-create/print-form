import { FormEvent, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
  const { products } = useCatalog({ limit: 12 });
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [isCategoriesHidden, setIsCategoriesHidden] = useState(false);
  const [categoriesHeight, setCategoriesHeight] = useState(0);
  const [productBoardHeight, setProductBoardHeight] = useState(0);
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
  } | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const productBoardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) {
      loadAddresses(user.id);
    } else {
      resetAddresses();
    }
  }, [loadAddresses, resetAddresses, user]);

  useEffect(() => {
    if (location.pathname === '/catalog') {
      setSearchValue(searchParams.get('q') ?? '');
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (!user) {
      setSellerProfile(null);
      return;
    }
    let isMounted = true;
    api
      .getSellerProfile()
      .then((response) => {
        if (isMounted) {
          setSellerProfile(response.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSellerProfile({ isSeller: false, profile: null });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  const categories = useMemo(() => {
    if (filterData.categories.length) {
      return filterData.categories;
    }
    return Array.from(new Set(products.map((product) => product.category))).filter(Boolean);
  }, [filterData.categories, products]);

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
    const handleScroll = () => {
      setIsCategoriesHidden(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll]);

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
  const showProductBoard = isCategoriesHidden && (isProductPage || isReviewPage) && productBoard;
  const ratingValue = productBoard?.ratingAvg ?? 0;
  const ratingCount = productBoard?.ratingCount ?? 0;
  const categoriesBarHeight = isCategoriesHidden ? (showProductBoard ? productBoardHeight : 0) : categoriesHeight;
  const isSeller = sellerProfile?.isSeller ?? false;
  const showBottomNav =
    !location.pathname.startsWith('/seller') &&
    !location.pathname.startsWith('/auth') &&
    !location.pathname.startsWith('/privacy-policy');
  const isFavorites = location.pathname === '/account' && searchParams.get('tab') === 'favorites';
  const isProfile = location.pathname === '/account' && (searchParams.get('tab') === 'profile' || !searchParams.get('tab'));

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
            <Link to="/account" className={styles.actionLink}>
              <span aria-hidden>🧾</span>
              <span>Заказы</span>
            </Link>
            <Link to="/account" className={styles.actionLink}>
              <span aria-hidden>❤</span>
              <span>Избранное</span>
            </Link>
            <Link to="/cart" className={styles.actionLink}>
              <span aria-hidden>🛒</span>
              <span>Корзина</span>
              <span className={styles.cartCount}>{cartItems.length}</span>
            </Link>
            {user ? (
              <div className={styles.profileBox}>
                <Link to="/account" className={styles.actionLink}>
                  <span aria-hidden>👤</span>
                  <span>{user.name}</span>
                </Link>
                <button className={styles.logoutButton} onClick={() => logout()}>
                  Выйти
                </button>
              </div>
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
            <button
              type="button"
              className={styles.mobileBurger}
              onClick={() => navigate('/categories')}
              aria-label="Открыть категории"
            >
              ☰
            </button>
            <div className={styles.mobileAddress}>
              <HeaderAddress variant="compact" />
            </div>
          </div>
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
        <div
          className={`${styles.categoriesBar} ${categoriesBarHeight === 0 ? styles.categoriesBarCollapsed : ''}`}
          style={{ height: `${categoriesBarHeight}px` }}
        >
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
                className={!activeCategory ? styles.categoryActive : styles.categoryButton}
                onClick={() => handleCategorySelect('')}
              >
                Все категории
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={activeCategory === category ? styles.categoryActive : styles.categoryButton}
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
                    <img src={productBoard.image} alt={productBoard.title} />
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
            to="/account?tab=favorites"
            className={`${styles.bottomNavItem} ${isFavorites ? styles.bottomNavItemActive : ''}`}
          >
            <span aria-hidden>❤</span>
            <span>Избранное</span>
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
            const nextAddresses = addresses.filter((address) => address.id !== addressId);
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

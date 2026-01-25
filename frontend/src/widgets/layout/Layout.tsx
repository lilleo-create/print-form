import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useAuthStore } from '../../app/store/authStore';
import { useAddressStore } from '../../app/store/addressStore';
import { AddressModal } from '../../shared/ui/address/AddressModal';
import { HeaderAddress } from '../../shared/ui/address/HeaderAddress';
import { ProductModal } from '../shop/ProductModal';
import { useFilters } from '../../features/catalog/useFilters';
import { useCatalog } from '../../features/catalog/useCatalog';
import { formatShortAddress } from '../../shared/lib/formatShortAddress';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const cartItems = useCartStore((state) => state.items);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filterData = useFilters();
  const { products } = useCatalog({ limit: 12 });
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [isCategoriesHidden, setCategoriesHidden] = useState(false);

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
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateVisibility = () => {
      const nextScrollY = window.scrollY;
      const shouldHide = nextScrollY > lastScrollY && nextScrollY > 120;
      setCategoriesHidden((prev) => (prev === shouldHide ? prev : shouldHide));
      lastScrollY = nextScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const categories = useMemo(() => {
    if (filterData.categories.length) {
      return filterData.categories;
    }
    return Array.from(new Set(products.map((product) => product.category))).filter(Boolean);
  }, [filterData.categories, products]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  const addressLabel = selectedAddress
    ? selectedAddress.isFavorite && selectedAddress.label
      ? selectedAddress.label
      : formatShortAddress(selectedAddress.addressText)
    : user?.address ?? 'Укажите адрес доставки';

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

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
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
            {user && (
              <div className={styles.addressSlot}>
                <HeaderAddress />
              </div>
            )}
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
        <div
          className={`${styles.categoriesSurface} ${
            isCategoriesHidden ? styles.categoriesSurfaceHidden : ''
          }`}
        >
          <div className={styles.categoriesBar}>
            <div className={styles.categoriesInner}>
              <div className={styles.categoriesGroup}>
                <span className={styles.categoriesTitle}>Категории</span>
                <div className={styles.categoriesList}>
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
                </div>
              </div>
              <div className={styles.categoriesMeta}>
                <div className={styles.addressLine}>
                  <span className={styles.marker}>📍</span>
                  <span>{addressLabel}</span>
                </div>
                <Link to="/auth/register" className={styles.sellButton}>
                  Продавайте на PrintForm
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
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

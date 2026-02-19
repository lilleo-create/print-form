import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { ShopHeader } from './components/ShopHeader/ShopHeader';
import { ShopInfoModal } from './components/ShopInfoModal/ShopInfoModal';
import { ShopFilters } from './components/ShopFilters/ShopFilters';
import { ShopCatalog } from './components/ShopCatalog/ShopCatalog';
import { useShopPage } from './hooks/useShopPage';
import { ProfileMenu } from '../../shared/layout/ProfileMenu';
import styles from './ShopPage.module.css';

export const ShopPage = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
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

  const [isInfoOpen, setInfoOpen] = useState(false);
  const openProfileMenuHandler = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      return;
    }
    openProfileMenu();
  };

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProfileMenu();
      }
    };

    document.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onEsc);
    };
  }, [closeProfileMenu, isProfileMenuOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    closeProfileMenu();
  }, [closeProfileMenu, location.pathname, location.search]);

  const {
    shop,
    shopLoading,
    shopError,
    filters,
    filterOptions,
    filtersLoading,
    filtersError,
    products,
    productsLoading,
    productsError,
    hasMore,
    sortKey,
    searchQuery,
    searchValue,
    toastMessage,
    setSearchValue,
    handleFilterChange,
    handleSortChange,
    resetFilters,
    applySearchNow,
    copyShopLink,
    loadMore,
    retryProducts,
    retryShop,
    retryFilters
  } = useShopPage(shopId);

  const hasFilters = useMemo(
    () => Boolean(filters.category || filters.material || filters.price || searchQuery),
    [filters.category, filters.material, filters.price, searchQuery]
  );

  return (
    <section className={styles.page}>
      <ShopHeader
        shop={shop}
        loading={shopLoading}
        error={shopError}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchSubmit={applySearchNow}
        onRetry={retryShop}
        onMessage={() => navigate('/account?tab=chats')}
        onOpenInfo={() => setInfoOpen(true)}
        onCopyLink={copyShopLink}
        onOpenProfileMenu={openProfileMenuHandler}
      />
      <div className="container">
        {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
        <div className={styles.layout}>
          <ShopFilters
            filters={filters}
            options={filterOptions}
            loading={filtersLoading}
            error={filtersError}
            onChange={handleFilterChange}
            onReset={resetFilters}
            onRetry={retryFilters}
          />
          <ShopCatalog
            products={products}
            loading={productsLoading}
            error={productsError}
            hasMore={hasMore}
            sortKey={sortKey}
            hasFilters={hasFilters}
            onSortChange={handleSortChange}
            onLoadMore={loadMore}
            onRetry={retryProducts}
          />
        </div>
      </div>
      <ShopInfoModal
        shop={shop}
        isOpen={isInfoOpen}
        onClose={() => setInfoOpen(false)}
        onComplaint={() => navigate('/account?tab=chats')}
      />

      <ProfileMenu
        isOpen={isProfileMenuOpen}
        pathname={location.pathname}
        searchTab={searchParams.get('tab')}
        onClose={closeProfileMenu}
        onLogout={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth:logout'));
          }
          closeProfileMenu();
        }}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      />
    </section>
  );
};

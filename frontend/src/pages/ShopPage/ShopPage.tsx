import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { ShopHeader } from './components/ShopHeader/ShopHeader';
import { ShopInfoModal } from './components/ShopInfoModal/ShopInfoModal';
import { ShopFilters } from './components/ShopFilters/ShopFilters';
import { ShopCatalog } from './components/ShopCatalog/ShopCatalog';
import { useShopPage } from './hooks/useShopPage';
import styles from './ShopPage.module.css';

export const ShopPage = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const openProfileMenu = useHeaderMenuStore((state) => state.openProfileMenu);
  const [isInfoOpen, setInfoOpen] = useState(false);
  const openProfileMenuHandler = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      return;
    }
    openProfileMenu();
  };

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
    () => Boolean(filters.category || filters.material || filters.size || filters.price || searchQuery),
    [filters.category, filters.material, filters.price, filters.size, searchQuery]
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
    </section>
  );
};

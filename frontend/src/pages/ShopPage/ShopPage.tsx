import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { ShopHeader } from './components/ShopHeader/ShopHeader';
import { ShopInfoModal } from './components/ShopInfoModal/ShopInfoModal';
import { ShopFilters } from './components/ShopFilters/ShopFilters';
import { ShopCatalog } from './components/ShopCatalog/ShopCatalog';
import { useShopPage } from './hooks/useShopPage';
import { ProfileMenu } from '../../shared/layout/ProfileMenu';
import { api } from '../../shared/api';
import styles from './ShopPage.module.css';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';

type SortKey = 'popular' | 'new' | 'cheap' | 'expensive';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'new',       label: 'Сначала новые' },
  { key: 'popular',   label: 'По рейтингу' },
  { key: 'cheap',     label: 'Дешевле' },
  { key: 'expensive', label: 'Дороже' },
];

const priceOptions = [
  { value: '', label: 'Любая цена' },
  { value: '0-2000', label: 'до 2 000 ₽' },
  { value: '2000-5000', label: '2 000 — 5 000 ₽' },
  { value: '5000-10000', label: '5 000 — 10 000 ₽' },
  { value: '10000-20000', label: '10 000 — 20 000 ₽' },
];

const SortIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
    <path d="M3 5h14M5 10h10M7 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FilterIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="7" cy="5" r="2" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="13" cy="10" r="2" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7" cy="15" r="2" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const ShopPage = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isProfileMenuOpen = useHeaderMenuStore((state) => state.isProfileMenuOpen);
  const openProfileMenu = useHeaderMenuStore((state) => state.openProfileMenu);
  const closeProfileMenu = useHeaderMenuStore((state) => state.closeProfileMenu);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
  });

  const [isInfoOpen, setInfoOpen] = useState(false);
  const [isCreatingSellerThread, setIsCreatingSellerThread] = useState(false);
  const [isSortOpen, setSortOpen] = useState(false);
  const [isFilterOpen, setFilterOpen] = useState(false);

  const sortBtnRef = useRef<HTMLButtonElement>(null);

  // close sort dropdown on outside click
  useEffect(() => {
    if (!isSortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortBtnRef.current && !sortBtnRef.current.closest('[data-sort-wrap]')?.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSortOpen]);

  const openProfileMenuHandler = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) return;
    openProfileMenu();
  };

  useBodyScrollLock(isProfileMenuOpen || isFilterOpen);

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeProfileMenu(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [closeProfileMenu, isProfileMenuOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { closeProfileMenu(); }, [closeProfileMenu, location.pathname, location.search]);

  const {
    shop, shopLoading, shopError,
    filters, filterOptions, filtersLoading, filtersError,
    products, productsLoading, productsError,
    hasMore, sortKey, searchQuery, searchValue, toastMessage,
    setSearchValue, handleFilterChange, handleSortChange,
    resetFilters, applySearchNow, copyShopLink,
    loadMore, retryProducts, retryShop, retryFilters
  } = useShopPage(shopId);

  const hasFilters = useMemo(
    () => Boolean(filters.category || filters.material || filters.price || searchQuery),
    [filters.category, filters.material, filters.price, searchQuery]
  );

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) { navigate(-1); return; }
    navigate('/catalog');
  };

  const handleMessageSeller = async () => {
    if (!shopId || isCreatingSellerThread) return;
    setIsCreatingSellerThread(true);
    try {
      const response = await api.chats.createSellerThread({ sellerId: shopId });
      navigate(`/account?tab=chats&threadId=${response.data.id}`);
    } catch { navigate('/account?tab=chats'); }
    finally { setIsCreatingSellerThread(false); }
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Сортировка';

  return (
    <section className={styles.page}>
      <ShopHeader
        shop={shop} loading={shopLoading} error={shopError}
        searchValue={searchValue} onSearchChange={setSearchValue}
        onSearchSubmit={applySearchNow} onRetry={retryShop}
        onMessage={handleMessageSeller} onBack={handleBack}
        onOpenInfo={() => setInfoOpen(true)} onCopyLink={copyShopLink}
        onOpenProfileMenu={openProfileMenuHandler}
      />

      {/* Mobile sticky bar */}
      <div className={styles.mobileBar}>
        {/* Sort with dropdown */}
        <div data-sort-wrap="" className={styles.sortWrap}>
          <button
            ref={sortBtnRef}
            className={`${styles.mobileBarBtn} ${sortKey !== 'new' ? styles.mobileBarActive : ''}`}
            onClick={() => setSortOpen((v) => !v)}
          >
            <SortIcon />
            <span className={styles.mobileBarBtnLabel}>{currentSortLabel}</span>
          </button>
          {isSortOpen && (
            <div className={styles.sortDropdown}>
              <p className={styles.sortDropdownTitle}>Показывать сначала</p>
              {SORT_OPTIONS.map((opt) => {
                const active = sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={styles.sortDropdownOption}
                    onClick={() => { handleSortChange(opt.key); setSortOpen(false); }}
                  >
                    <span>{opt.label}</span>
                    <span className={active ? styles.radioCircleActive : styles.radioCircle}>
                      {active && <span className={styles.radioDot} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.mobileBarSep} />

        <button
          className={`${styles.mobileBarBtn} ${hasFilters ? styles.mobileBarActive : ''}`}
          onClick={() => setFilterOpen(true)}
        >
          <FilterIcon />
        </button>

        <div className={styles.mobileBarSep} />

        <div className={styles.mobileChips}>
          {filterOptions.categories.slice(0, 8).map((cat) => (
            <button
              key={cat}
              className={filters.category === cat ? styles.mobileChipActive : styles.mobileChip}
              onClick={() => handleFilterChange('category', filters.category === cat ? '' : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="container">
        {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
        <div className={styles.layout}>
          <ShopFilters
            filters={filters} options={filterOptions}
            loading={filtersLoading} error={filtersError}
            onChange={handleFilterChange} onReset={resetFilters} onRetry={retryFilters}
          />
          <ShopCatalog
            products={products} loading={productsLoading || isCreatingSellerThread}
            error={productsError} hasMore={hasMore} sortKey={sortKey}
            hasFilters={hasFilters} onSortChange={handleSortChange}
            onLoadMore={loadMore} onRetry={retryProducts}
          />
        </div>
      </div>

      <ShopInfoModal
        shop={shop} isOpen={isInfoOpen}
        onClose={() => setInfoOpen(false)}
        onComplaint={() => navigate('/account?tab=chats')}
      />

      {/* Filter bottom sheet — custom lists (no native <select>) */}
      {isFilterOpen && (
        <div className={styles.filterOverlay} onClick={() => setFilterOpen(false)}>
          <div className={styles.filterSheet} onClick={(e) => e.stopPropagation()}>
            <p className={styles.filterSheetTitle}>Фильтры</p>
            <div className={styles.filterSheetContent}>

              <div className={styles.filterGroup}>
                <p className={styles.filterGroupLabel}>Категория</p>
                <div className={styles.filterOptions}>
                  <button
                    className={!filters.category ? styles.filterOptionActive : styles.filterOption}
                    onClick={() => handleFilterChange('category', '')}
                  >Все</button>
                  {filterOptions.categories.map((c) => (
                    <button
                      key={c}
                      className={filters.category === c ? styles.filterOptionActive : styles.filterOption}
                      onClick={() => handleFilterChange('category', filters.category === c ? '' : c)}
                    >{c}</button>
                  ))}
                </div>
              </div>

              <div className={styles.filterGroup}>
                <p className={styles.filterGroupLabel}>Материал</p>
                <div className={styles.filterOptions}>
                  <button
                    className={!filters.material ? styles.filterOptionActive : styles.filterOption}
                    onClick={() => handleFilterChange('material', '')}
                  >Все</button>
                  {filterOptions.materials.map((m) => (
                    <button
                      key={m}
                      className={filters.material === m ? styles.filterOptionActive : styles.filterOption}
                      onClick={() => handleFilterChange('material', filters.material === m ? '' : m)}
                    >{m}</button>
                  ))}
                </div>
              </div>

              <div className={styles.filterGroup}>
                <p className={styles.filterGroupLabel}>Цена</p>
                <div className={styles.filterOptions}>
                  {priceOptions.map((o) => (
                    <button
                      key={o.value}
                      className={filters.price === o.value ? styles.filterOptionActive : styles.filterOption}
                      onClick={() => handleFilterChange('price', o.value)}
                    >{o.label}</button>
                  ))}
                </div>
              </div>

            </div>
            <div className={styles.filterSheetActions}>
              <button onClick={() => setFilterOpen(false)}>Применить</button>
              <button onClick={() => { resetFilters(); setFilterOpen(false); }}>Сбросить</button>
            </div>
          </div>
        </div>
      )}

      <ProfileMenu
        isOpen={isProfileMenuOpen} pathname={location.pathname}
        searchTab={searchParams.get('tab')} onClose={closeProfileMenu}
        onLogout={() => { window.dispatchEvent(new Event('auth:logout')); closeProfileMenu(); }}
        theme={theme}
        onToggleTheme={() => setTheme((p) => (p === 'light' ? 'dark' : 'light'))}
      />
    </section>
  );
};

import { useEffect, useRef, useState } from 'react';
import { Product } from '../../../../shared/types';
import { ProductCard } from '../../../../widgets/shop/ProductCard';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import styles from './ShopCatalog.module.css';

type SortKey = 'popular' | 'new' | 'cheap' | 'expensive';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'new',       label: 'Сначала новые' },
  { key: 'popular',   label: 'По рейтингу' },
  { key: 'cheap',     label: 'Дешевле' },
  { key: 'expensive', label: 'Дороже' },
];

type ShopCatalogProps = {
  products: Product[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  sortKey: SortKey;
  hasFilters: boolean;
  onSortChange: (sort: SortKey) => void;
  onLoadMore: () => void;
  onRetry: () => void;
};

export const ShopCatalog = ({
  products, loading, error, hasMore, sortKey,
  onSortChange, onLoadMore, onRetry
}: ShopCatalogProps) => {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const currentLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Сортировка';

  return (
    <div className={styles.catalog}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2>Товары</h2>
          <p>{products.length} товаров</p>
        </div>
        <div className={styles.sortWrap} ref={sortRef}>
          <button
            type="button"
            className={`${styles.sortPill} ${sortKey !== 'new' ? styles.sortPillActive : ''}`}
            onClick={() => setSortOpen((v) => !v)}
          >
            <span className={styles.sortIcon}>≡</span>
            {currentLabel}
          </button>
          {sortOpen && (
            <div className={styles.dropdown}>
              <p className={styles.dropdownHeader}>Показывать сначала</p>
              {SORT_OPTIONS.map((opt) => {
                const active = sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={styles.dropdownOption}
                    onClick={() => { onSortChange(opt.key); setSortOpen(false); }}
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
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={styles.cardSkeleton} />)}
        </div>
      ) : error ? (
        <div className={styles.error}>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>Повторить</button>
        </div>
      ) : products.length === 0 ? (
        <p className={styles.empty}>Товары не найдены</p>
      ) : (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {hasMore && !loading && !error && (
        <div className={styles.loadMore}>
          <button type="button" className={styles.loadMoreBtn} onClick={onLoadMore}>
            Загрузить ещё
          </button>
        </div>
      )}
    </div>
  );
};

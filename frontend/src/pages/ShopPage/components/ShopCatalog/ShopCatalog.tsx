import { Product } from '../../../../shared/types';
import { ProductCard } from '../../../../widgets/shop/ProductCard';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import styles from './ShopCatalog.module.css';

type SortKey = 'popular' | 'new' | 'cheap' | 'expensive';

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
  products,
  loading,
  error,
  hasMore,
  sortKey,
  onSortChange,
  onLoadMore,
  onRetry
}: ShopCatalogProps) => {
  return (
    <div className={styles.catalog}>
      <div className={styles.toolbar}>
        <div>
          <h2>Товары</h2>
          <p>{products.length} товаров</p>
        </div>
        <div className={styles.sort}>
          <span>Сортировка</span>
          <select value={sortKey} onChange={(e) => onSortChange(e.target.value as SortKey)}>
            <option value="new">Сначала новые</option>
            <option value="popular">По рейтингу</option>
            <option value="cheap">Дешевле</option>
            <option value="expensive">Дороже</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      ) : error ? (
        <div className={styles.error}>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>Повторить</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {hasMore && !loading && !error && (
        <div className={styles.loadMore}>
          <button type="button" onClick={onLoadMore}>
            Загрузить ещё
          </button>
        </div>
      )}
    </div>
  );
};

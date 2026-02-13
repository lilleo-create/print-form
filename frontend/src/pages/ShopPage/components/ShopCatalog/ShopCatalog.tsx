import { Button } from '../../../../shared/ui/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { Select } from '../../../../shared/ui/Select';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { ProductCard } from '../../../../widgets/shop/ProductCard';
import type { Product } from '../../../../shared/types';
import styles from './ShopCatalog.module.css';

interface ShopCatalogProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  sortKey: 'popular' | 'new' | 'cheap' | 'expensive';
  hasFilters: boolean;
  onSortChange: (value: 'popular' | 'new' | 'cheap' | 'expensive') => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

const sortOptions: Array<{ value: ShopCatalogProps['sortKey']; label: string }> = [
  { value: 'popular', label: 'Популярные' },
  { value: 'new', label: 'Новые' },
  { value: 'cheap', label: 'Дешевле' },
  { value: 'expensive', label: 'Дороже' }
];

export const ShopCatalog = ({
  products,
  loading,
  error,
  hasMore,
  sortKey,
  hasFilters,
  onSortChange,
  onLoadMore,
  onRetry
}: ShopCatalogProps) => {
  return (
    <div className={styles.catalog}>
      <div className={styles.toolbar}>
        <div>
          <h2>Товары магазина</h2>
          <p>Подберите товар у выбранного продавца.</p>
        </div>
        <label className={styles.sort}>
          Сортировка
          <Select value={sortKey} onChange={(event) => onSortChange(event.target.value as ShopCatalogProps['sortKey'])}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {error && (
        <div className={styles.error}>
          <span>Не удалось загрузить товары.</span>
          <Button variant="secondary" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className={styles.cardSkeleton} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Ничего не найдено по выбранным фильтрам' : 'В магазине пока нет товаров'}
          description={hasFilters ? 'Попробуйте изменить параметры фильтров.' : 'Возвращайтесь позже за новинками.'}
        />
      ) : (
        <>
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className={styles.loadMore}>
            <Button
              variant="secondary"
              onClick={onLoadMore}
              disabled={loading || !hasMore}
            >
              {hasMore ? (loading ? 'Загрузка...' : 'Показать ещё') : 'Больше нет товаров'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

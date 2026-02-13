import { Button } from '../../../../shared/ui/Button';
import { Select } from '../../../../shared/ui/Select';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import styles from './ShopFilters.module.css';

interface ShopFiltersProps {
  filters: {
    category: string;
    material: string;
    size: string;
    price: string;
  };
  options: {
    categories: string[];
    materials: string[];
    sizes: string[];
  };
  loading: boolean;
  error: string | null;
  onChange: (key: 'category' | 'material' | 'size' | 'price', value: string) => void;
  onReset: () => void;
  onRetry: () => void;
}

const priceOptions = [
  { value: '', label: 'Любая' },
  { value: '0-2000', label: 'до 2 000 ₽' },
  { value: '2000-5000', label: '2 000 — 5 000 ₽' },
  { value: '5000-10000', label: '5 000 — 10 000 ₽' },
  { value: '10000-20000', label: '10 000 — 20 000 ₽' }
];

export const ShopFilters = ({
  filters,
  options,
  loading,
  error,
  onChange,
  onReset,
  onRetry
}: ShopFiltersProps) => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h3>Фильтры</h3>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Сбросить
        </Button>
      </div>
      {error && (
        <div className={styles.error}>
          <span>Не удалось загрузить фильтры.</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      )}
      {loading ? (
        <div className={styles.skeletons}>
          <Skeleton className={styles.skeleton} />
          <Skeleton className={styles.skeleton} />
          <Skeleton className={styles.skeleton} />
        </div>
      ) : (
        <div className={styles.content}>
          <label className={styles.field}>
            Категория
            <Select value={filters.category} onChange={(event) => onChange('category', event.target.value)}>
              <option value="">Все</option>
              {options.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </label>
          <label className={styles.field}>
            Материал
            <Select value={filters.material} onChange={(event) => onChange('material', event.target.value)}>
              <option value="">Все</option>
              {options.materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </Select>
          </label>
          <label className={styles.field}>
            Размер
            <Select value={filters.size} onChange={(event) => onChange('size', event.target.value)}>
              <option value="">Все</option>
              {options.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
          <label className={styles.field}>
            Цена
            <Select value={filters.price} onChange={(event) => onChange('price', event.target.value)}>
              {priceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}
    </aside>
  );
};

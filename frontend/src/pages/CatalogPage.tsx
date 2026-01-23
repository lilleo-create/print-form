import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../widgets/shop/ProductCard';
import { useCatalog } from '../features/catalog/useCatalog';
import { useFilters } from '../features/catalog/useFilters';
import { FilterModal } from '../widgets/catalog/FilterModal';
import { Button } from '../shared/ui/Button';
import styles from './CatalogPage.module.css';

const sortOptions = {
  createdAt: 'По дате добавления',
  rating: 'По рейтингу'
} as const;

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterData = useFilters();
  const [isModalOpen, setModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    category: searchParams.get('category') ?? '',
    material: searchParams.get('material') ?? '',
    price: searchParams.get('price') ?? '',
    size: searchParams.get('size') ?? ''
  });

  const sort = (searchParams.get('sort') as 'createdAt' | 'rating') ?? 'createdAt';
  const { products, loading, error } = useCatalog({
    ...filters,
    sort,
    order: 'desc'
  });

  const filteredProducts = useMemo(() => {
    return products;
  }, [products]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.material) params.set('material', filters.material);
    if (filters.price) params.set('price', filters.price);
    if (filters.size) params.set('size', filters.size);
    if (sort) params.set('sort', sort);
    setSearchParams(params);
    setModalOpen(false);
  };

  const handleSortChange = (value: 'createdAt' | 'rating') => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', value);
    setSearchParams(params);
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Каталог моделей</h1>
            <p>Подберите готовые изделия от проверенных продавцов.</p>
          </div>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Фильтр
          </Button>
        </div>
        <div className={styles.controls}>
          <span className={styles.controlsTitle}>Быстрая сортировка</span>
          <div className={styles.sortButtons}>
            {Object.entries(sortOptions).map(([value, label]) => (
              <Button
                key={value}
                variant={sort === value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleSortChange(value as 'createdAt' | 'rating')}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className={styles.loading}>Загрузка...</p>
        ) : error ? (
          <p className={styles.loading}>Не удалось загрузить каталог.</p>
        ) : (
          <div className={styles.grid}>
            {filteredProducts.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        )}
      </div>
      <FilterModal
        isOpen={isModalOpen}
        filters={filters}
        filterOptions={filterData}
        onChange={(key, value) =>
          setFilters((prev) => ({
            ...prev,
            [key]: value
          }))
        }
        onApply={applyFilters}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../widgets/shop/ProductCard';
import { useCatalog } from '../features/catalog/useCatalog';
import { useFilters } from '../features/catalog/useFilters';
import { FilterModal } from '../widgets/catalog/FilterModal';
import { Button } from '../shared/ui/Button';
import styles from './CatalogPage.module.css';

const sortOptions = [
  { id: 'newest', label: 'Сначала новые', sort: 'createdAt', order: 'desc' },
  { id: 'oldest', label: 'Сначала старые', sort: 'createdAt', order: 'asc' },
  { id: 'rating-high', label: 'Рейтинг выше', sort: 'rating', order: 'desc' },
  { id: 'rating-low', label: 'Рейтинг ниже', sort: 'rating', order: 'asc' }
] as const;

const deliveryOptions = [
  { id: '1-3', label: '1–3 дня', min: 1, max: 3 },
  { id: '4-7', label: '4–7 дней', min: 4, max: 7 },
  { id: '8+', label: '8+ дней', min: 8 }
] as const;

const parseDeliveryDays = (value?: string) => {
  if (!value) return 7;
  const match = value.match(/\d+/);
  if (!match) return 7;
  const amount = Number(match[0]);
  if (value.toLowerCase().includes('час')) {
    return Math.max(1, Math.ceil(amount / 24));
  }
  return amount;
};

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterData = useFilters();
  const [isModalOpen, setModalOpen] = useState(false);

  const parseFilters = () => ({
    category: searchParams.get('category') ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    ratingMin: searchParams.get('ratingMin') ?? '',
    deliveryTimes: searchParams.getAll('delivery') ?? [],
    color: searchParams.get('color') ?? '',
    material: searchParams.get('material') ?? '',
    size: searchParams.get('size') ?? ''
  });

  const [filters, setFilters] = useState(parseFilters());

  useEffect(() => {
    setFilters(parseFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sort = (searchParams.get('sort') as 'createdAt' | 'rating') ?? 'createdAt';
  const order = (searchParams.get('order') as 'asc' | 'desc') ?? 'desc';
  const query = searchParams.get('q') ?? '';

  const { products, loading, error } = useCatalog({
    category: filters.category || undefined,
    material: filters.material || undefined,
    size: filters.size || undefined,
    minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
    ratingMin: filters.ratingMin ? Number(filters.ratingMin) : undefined,
    color: filters.color || undefined,
    q: query || undefined,
    sort,
    order
  });

  const filteredProducts = useMemo(() => {
    if (!filters.deliveryTimes.length) return products;
    return products.filter((product) => {
      const days = parseDeliveryDays(product.printTime);
      return filters.deliveryTimes.some((key) => {
        const option = deliveryOptions.find((item) => item.id === key);
        if (!option) return true;
        const meetsMin = option.min ? days >= option.min : true;
        const meetsMax = option.max ? days <= option.max : true;
        return meetsMin && meetsMax;
      });
    });
  }, [filters.deliveryTimes, products]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.ratingMin) params.set('ratingMin', filters.ratingMin);
    if (filters.color) params.set('color', filters.color);
    if (filters.material) params.set('material', filters.material);
    if (filters.size) params.set('size', filters.size);
    if (filters.deliveryTimes.length) {
      filters.deliveryTimes.forEach((value) => params.append('delivery', value));
    }
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    setSearchParams(params);
    setModalOpen(false);
  };

  const handleSortChange = (nextSort: 'createdAt' | 'rating', nextOrder: 'asc' | 'desc') => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', nextSort);
    params.set('order', nextOrder);
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
            Фильтры
          </Button>
        </div>
        <div className={styles.controls}>
          <span className={styles.controlsTitle}>Быстрая сортировка</span>
          <div className={styles.sortButtons}>
            {sortOptions.map((option) => (
              <Button
                key={option.id}
                variant={sort === option.sort && order === option.order ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleSortChange(option.sort, option.order)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.filterGroup}>
              <h3>Категория</h3>
              <div className={styles.filterList}>
                <button
                  type="button"
                  className={!filters.category ? styles.filterActive : styles.filterButton}
                  onClick={() => setFilters((prev) => ({ ...prev, category: '' }))}
                >
                  Все категории
                </button>
                {filterData.categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={filters.category === category ? styles.filterActive : styles.filterButton}
                    onClick={() => setFilters((prev) => ({ ...prev, category }))}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterGroup}>
              <h3>Цена</h3>
              <div className={styles.priceFields}>
                <input
                  type="number"
                  placeholder="От"
                  value={filters.minPrice}
                  onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
                />
                <input
                  type="number"
                  placeholder="До"
                  value={filters.maxPrice}
                  onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
                />
              </div>
            </div>
            <div className={styles.filterGroup}>
              <h3>Минимальный рейтинг</h3>
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                value={filters.ratingMin}
                onChange={(event) => setFilters((prev) => ({ ...prev, ratingMin: event.target.value }))}
              />
            </div>
            <div className={styles.filterGroup}>
              <h3>Срок доставки</h3>
              <div className={styles.checkboxList}>
                {deliveryOptions.map((option) => (
                  <label key={option.id} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={filters.deliveryTimes.includes(option.id)}
                      onChange={(event) =>
                        setFilters((prev) => {
                          const next = event.target.checked
                            ? [...prev.deliveryTimes, option.id]
                            : prev.deliveryTimes.filter((value) => value !== option.id);
                          return { ...prev, deliveryTimes: next };
                        })
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.filterGroup}>
              <h3>Цвет</h3>
              <select
                value={filters.color}
                onChange={(event) => setFilters((prev) => ({ ...prev, color: event.target.value }))}
              >
                <option value="">Любой</option>
                {filterData.colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={applyFilters}>Показать</Button>
          </aside>
          <div className={styles.results}>
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
        </div>
      </div>
      <FilterModal
        isOpen={isModalOpen}
        filters={{ material: filters.material, size: filters.size }}
        filterOptions={{ materials: filterData.materials, sizes: filterData.sizes }}
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

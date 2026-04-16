import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../widgets/shop/ProductCard';
import { CatalogBoot } from '../features/catalog/CatalogBoot';
import { FilterModal } from '../widgets/catalog/FilterModal';
import { CatalogHeader } from '../widgets/catalog/CatalogHeader';
import { Button } from '../shared/ui/Button';
import { Skeleton } from '../shared/ui/Skeleton';
import styles from './CatalogPage.module.css';

type SortValue = 'createdAt' | 'rating' | 'price';

type CatalogFiltersState = {
  category: string;
  material: string;
  price: string;
  color: string;
  minRating: string;
  inStock: boolean;
};

const sortOptions: Record<SortValue, string> = {
  createdAt: 'Сначала новые',
  rating: 'По рейтингу',
  price: 'По цене'
};

const parsePriceRange = (price: string) => {
  if (!price) return 'Любая цена';
  const [min, max] = price.split('-');
  if (min && max) return `${Number(min).toLocaleString('ru-RU')} – ${Number(max).toLocaleString('ru-RU')} ₽`;
  if (!min && max) return `до ${Number(max).toLocaleString('ru-RU')} ₽`;
  if (min && !max) return `от ${Number(min).toLocaleString('ru-RU')} ₽`;
  return 'Любая цена';
};

const parsePrice = (value: string) => {
  const [minRaw, maxRaw] = value.split('-');
  const min = Number(minRaw || 0);
  const max = Number(maxRaw || Number.POSITIVE_INFINITY);
  return { min, max };
};

const readFiltersFromUrl = (searchParams: URLSearchParams): CatalogFiltersState => ({
  category: searchParams.get('category') ?? '',
  material: searchParams.get('material') ?? '',
  price: searchParams.get('price') ?? '',
  color: searchParams.get('color') ?? '',
  minRating: searchParams.get('minRating') ?? '',
  inStock: searchParams.get('inStock') === '1'
});

const syncFiltersToParams = (params: URLSearchParams, filters: CatalogFiltersState) => {
  if (filters.category) params.set('category', filters.category);
  else params.delete('category');

  if (filters.material) params.set('material', filters.material);
  else params.delete('material');

  if (filters.price) params.set('price', filters.price);
  else params.delete('price');

  if (filters.color) params.set('color', filters.color);
  else params.delete('color');

  if (filters.minRating) params.set('minRating', filters.minRating);
  else params.delete('minRating');

  if (filters.inStock) params.set('inStock', '1');
  else params.delete('inStock');
};

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<CatalogFiltersState>(() => readFiltersFromUrl(searchParams));

  useEffect(() => {
    setFilters(readFiltersFromUrl(searchParams));
  }, [searchParams]);

  const sort = (searchParams.get('sort') as SortValue) ?? 'createdAt';

  const catalogParams = useMemo(
    () => ({
      category: searchParams.get('category') ?? '',
      material: searchParams.get('material') ?? '',
      price: searchParams.get('price') ?? '',
      q: searchParams.get('q') ?? '',
      sort,
      order: sort === 'price' ? ('asc' as const) : ('desc' as const)
    }),
    [searchParams, sort]
  );

  const activeCategory = searchParams.get('category') ?? '';

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);
    syncFiltersToParams(params, filters);
    params.delete('page');
    setSearchParams(params);
    setModalOpen(false);
  };

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams);
    ['category', 'material', 'price', 'color', 'minRating', 'inStock', 'q', 'sort'].forEach((key) => params.delete(key));
    setSearchParams(params);
    setFilters({
      category: '',
      material: '',
      price: '',
      color: '',
      minRating: '',
      inStock: false
    });
  };

  const handleSortChange = (value: SortValue) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', value);
    setSearchParams(params);
  };

  const handleCategorySelect = (category?: string) => {
    const params = new URLSearchParams(searchParams);
    if (category) params.set('category', category);
    else params.delete('category');
    setSearchParams(params);
    setFilters((prev) => ({ ...prev, category: category ?? '' }));
  };

  return (
    <CatalogBoot filters={catalogParams}>
      {({ filterData, products, loading, error }) => {
        const urlFilters = readFiltersFromUrl(searchParams);

        const colors = Array.from(new Set(products.map((product) => product.color).filter(Boolean))).slice(0, 12);

        const filteredProducts = products.filter((product) => {
          if (urlFilters.color && product.color !== urlFilters.color) return false;
          if (urlFilters.minRating && (product.ratingAvg ?? 0) < Number(urlFilters.minRating)) return false;
          if (urlFilters.inStock && typeof product.stock === 'number' && product.stock <= 0) return false;
          if (urlFilters.inStock && typeof product.stock !== 'number') return false;
          if (urlFilters.price) {
            const { min, max } = parsePrice(urlFilters.price);
            if (product.price < min || product.price > max) return false;
          }
          return true;
        });

        const categories = filterData.categories.length
          ? filterData.categories
          : Array.from(new Set(products.map((product) => product.category))).filter(Boolean);

        const activeFilters = [
          urlFilters.category ? `Категория: ${urlFilters.category}` : null,
          urlFilters.material ? `Материал: ${urlFilters.material}` : null,
          urlFilters.price ? parsePriceRange(urlFilters.price) : null,
          urlFilters.color ? `Цвет: ${urlFilters.color}` : null,
          urlFilters.minRating ? `Рейтинг от ${urlFilters.minRating}` : null,
          urlFilters.inStock ? 'Только в наличии' : null,
          catalogParams.q ? `Поиск: ${catalogParams.q}` : null
        ].filter(Boolean) as string[];

        return (
          <section className={styles.page}>
            <CatalogHeader
              categories={categories}
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
            />

            <div className={`container ${styles.wrapper}`}>
              <aside className={styles.sidebar}>
                <div className={styles.sidebarHead}>
                  <h2>Фильтры</h2>
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Сбросить
                  </Button>
                </div>

                <label className={styles.field}>
                  Категория
                  <select
                    value={filters.category}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, category: event.target.value }))
                    }
                  >
                    <option value="">Все категории</option>
                    {filterData.categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  Материал
                  <select
                    value={filters.material}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, material: event.target.value }))
                    }
                  >
                    <option value="">Любой материал</option>
                    {filterData.materials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  Диапазон цены
                  <select
                    value={filters.price}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, price: event.target.value }))
                    }
                  >
                    <option value="">Любая</option>
                    <option value="0-1000">до 1 000 ₽</option>
                    <option value="1000-3000">1 000 – 3 000 ₽</option>
                    <option value="3000-7000">3 000 – 7 000 ₽</option>
                    <option value="7000-">от 7 000 ₽</option>
                  </select>
                </label>

                {colors.length > 0 ? (
                  <label className={styles.field}>
                    Цвет
                    <select
                      value={filters.color}
                      onChange={(event) => setFilters((prev) => ({ ...prev, color: event.target.value }))}
                    >
                      <option value="">Любой цвет</option>
                      {colors.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className={styles.field}>
                  Минимальный рейтинг
                  <select
                    value={filters.minRating}
                    onChange={(event) => setFilters((prev) => ({ ...prev, minRating: event.target.value }))}
                  >
                    <option value="">Любой</option>
                    <option value="4">4.0+</option>
                    <option value="3">3.0+</option>
                  </select>
                </label>

                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={filters.inStock}
                    onChange={(event) => setFilters((prev) => ({ ...prev, inStock: event.target.checked }))}
                  />
                  Только в наличии
                </label>

                <Button onClick={applyFilters}>Применить</Button>
              </aside>

              <div className={styles.content}>
                <div className={styles.header}>
                  <div>
                    <h1>Каталог</h1>
                    <p>Один источник поиска: строка в хедере. Фильтры и сортировка синхронизированы с URL.</p>
                  </div>
                  <Button className={styles.mobileFilterButton} variant="secondary" onClick={() => setModalOpen(true)}>
                    Фильтры
                  </Button>
                </div>

                <div className={styles.topControls}>
                  <select
                    className={styles.sortSelect}
                    value={sort}
                    onChange={(event) => handleSortChange(event.target.value as SortValue)}
                  >
                    {Object.entries(sortOptions).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.resultMeta}>
                  <span>Найдено: {loading ? '...' : filteredProducts.length}</span>
                  {activeFilters.length > 0 ? (
                    <div className={styles.activeFilters}>
                      {activeFilters.map((value) => (
                        <span key={value} className={styles.filterChip}>
                          {value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {loading ? (
                  <div className={styles.grid}>
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className={styles.cardSkeleton}>
                        <Skeleton className={styles.cardSkeletonMedia} />
                        <Skeleton className={styles.cardSkeletonTitle} />
                        <Skeleton className={styles.cardSkeletonPrice} />
                        <Skeleton className={styles.cardSkeletonMeta} />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className={styles.stateBox}>
                    <p>Не удалось загрузить каталог.</p>
                    <Button variant="secondary" onClick={() => window.location.reload()}>
                      Повторить
                    </Button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className={styles.stateBox}>
                    <p>Ничего не найдено. Попробуйте изменить фильтры или запрос.</p>
                    <Button variant="secondary" onClick={resetFilters}>
                      Сбросить фильтры
                    </Button>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {filteredProducts.map((product) => (
                      <ProductCard product={product} key={product.id} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <FilterModal
              isOpen={isModalOpen}
              filters={filters}
              filterOptions={{ ...filterData, colors }}
              onChange={(key, value) =>
                setFilters((prev) => ({
                  ...prev,
                  [key]: value
                }))
              }
              onToggleStock={(value) => setFilters((prev) => ({ ...prev, inStock: value }))}
              onApply={applyFilters}
              onReset={resetFilters}
              onClose={() => setModalOpen(false)}
            />
          </section>
        );
      }}
    </CatalogBoot>
  );
};

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

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setModalOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');

  const [filters, setFilters] = useState({
    category: searchParams.get('category') ?? '',
    material: searchParams.get('material') ?? '',
    price: searchParams.get('price') ?? ''
  });

  useEffect(() => {
    setFilters({
      category: searchParams.get('category') ?? '',
      material: searchParams.get('material') ?? '',
      price: searchParams.get('price') ?? ''
    });
    setSearchInput(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const currentQ = searchParams.get('q') ?? '';
      if (searchInput.trim() === currentQ.trim()) return;
      const params = new URLSearchParams(searchParams);
      if (searchInput.trim()) {
        params.set('q', searchInput.trim());
      } else {
        params.delete('q');
      }
      params.delete('page');
      setSearchParams(params, { replace: true });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput, searchParams, setSearchParams]);

  const sort = (searchParams.get('sort') as SortValue) ?? 'createdAt';
  const q = searchParams.get('q') ?? '';

  const catalogParams = useMemo(
    () => ({
      ...filters,
      q,
      sort,
      order: sort === 'price' ? ('asc' as const) : ('desc' as const)
    }),
    [filters, q, sort]
  );

  const activeCategory = searchParams.get('category') ?? '';

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);
    if (filters.category) params.set('category', filters.category);
    else params.delete('category');

    if (filters.material) params.set('material', filters.material);
    else params.delete('material');

    if (filters.price) params.set('price', filters.price);
    else params.delete('price');

    params.delete('page');
    setSearchParams(params);
    setModalOpen(false);
  };

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('category');
    params.delete('material');
    params.delete('price');
    params.delete('q');
    params.delete('sort');
    setSearchParams(params);
    setSearchInput('');
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
  };

  return (
    <CatalogBoot filters={catalogParams}>
      {({ filterData, products, loading, error }) => {
        const categories = filterData.categories.length
          ? filterData.categories
          : Array.from(new Set(products.map((product) => product.category))).filter(Boolean);

        const activeFilters = [
          filters.category ? `Категория: ${filters.category}` : null,
          filters.material ? `Материал: ${filters.material}` : null,
          filters.price ? parsePriceRange(filters.price) : null,
          q ? `Поиск: ${q}` : null
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

                <Button onClick={applyFilters}>Применить</Button>
              </aside>

              <div className={styles.content}>
                <div className={styles.header}>
                  <div>
                    <h1>Каталог</h1>
                    <p>Поиск, фильтры и сортировка синхронизированы с URL.</p>
                  </div>
                  <Button className={styles.mobileFilterButton} variant="secondary" onClick={() => setModalOpen(true)}>
                    Фильтры
                  </Button>
                </div>

                <div className={styles.topControls}>
                  <input
                    className={styles.search}
                    placeholder="Поиск по товарам"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
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
                  <span>Найдено: {loading ? '...' : products.length}</span>
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
                ) : products.length === 0 ? (
                  <div className={styles.stateBox}>
                    <p>Ничего не найдено. Попробуйте изменить фильтры или запрос.</p>
                    <Button variant="secondary" onClick={resetFilters}>
                      Сбросить фильтры
                    </Button>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {products.map((product) => (
                      <ProductCard product={product} key={product.id} />
                    ))}
                  </div>
                )}
              </div>
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
              onReset={resetFilters}
              onClose={() => setModalOpen(false)}
            />
          </section>
        );
      }}
    </CatalogBoot>
  );
};

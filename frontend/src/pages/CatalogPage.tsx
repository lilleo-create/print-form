import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../widgets/shop/ProductCard';
import { CatalogBoot } from '../features/catalog/CatalogBoot';
import { FilterModal } from '../widgets/catalog/FilterModal';
import { Button } from '../shared/ui/Button';
import { Select } from '../shared/ui/Select';
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

const parsePriceInputs = (price: string) => {
  const [minRaw = '', maxRaw = ''] = price.split('-');
  return {
    min: minRaw ? Number(minRaw) : null,
    max: maxRaw ? Number(maxRaw) : null
  };
};

const normalizePriceFilter = (min: number | null, max: number | null) => {
  const safeMin = typeof min === 'number' && Number.isFinite(min) && min > 0 ? Math.floor(min) : null;
  const safeMax = typeof max === 'number' && Number.isFinite(max) && max > 0 ? Math.floor(max) : null;

  if (safeMin && safeMax) return `${Math.min(safeMin, safeMax)}-${Math.max(safeMin, safeMax)}`;
  if (safeMin) return `${safeMin}-`;
  if (safeMax) return `-${safeMax}`;
  return '';
};

const COLOR_SWATCHES: Record<string, string> = {
  white: '#e8ecf4',
  'белый': '#e8ecf4',
  black: '#111315',
  'черный': '#111315',
  'чёрный': '#111315',
  gray: '#9fa8b8',
  'серый': '#9fa8b8',
  beige: '#d4b89c',
  'бежевый': '#d4b89c',
  blue: '#4d70ff',
  'синий': '#4d70ff',
  red: '#dd4e53',
  'красный': '#dd4e53',
  green: '#48aa63',
  'зеленый': '#48aa63',
  'зелёный': '#48aa63',
  yellow: '#eabf3f',
  'желтый': '#eabf3f',
  'жёлтый': '#eabf3f',
  orange: '#ef8a3a',
  'оранжевый': '#ef8a3a',
  pink: '#d67ac3',
  'розовый': '#d67ac3'
};

const getColorSwatch = (name: string) => COLOR_SWATCHES[name.trim().toLowerCase()] ?? '#b8becb';

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSortOpen, setSortOpen] = useState(false);
  const [filters, setFilters] = useState<CatalogFiltersState>(() => readFiltersFromUrl(searchParams));

  useEffect(() => {
    setFilters(readFiltersFromUrl(searchParams));
  }, [searchParams]);

  const sort = (searchParams.get('sort') as SortValue) ?? 'createdAt';

  const catalogParams = useMemo(
    () => ({
      category: searchParams.get('category') ?? '',
      material: '',
      price: searchParams.get('price') ?? '',
      q: searchParams.get('q') ?? '',
      sort,
      order: sort === 'price' ? ('asc' as const) : ('desc' as const)
    }),
    [searchParams, sort]
  );

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    setSearchParams(params);
  };

  const setStockFilter = (isEnabled: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (isEnabled) params.set('inStock', '1');
    else params.delete('inStock');
    params.delete('page');
    setSearchParams(params);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);
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

    params.delete('page');
    setSearchParams(params);
    setModalOpen(false);
  };

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams);
    ['category', 'material', 'price', 'color', 'minRating', 'inStock', 'sort'].forEach((key) => params.delete(key));
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

  const urlFilters = readFiltersFromUrl(searchParams);

  return (
    <CatalogBoot filters={catalogParams}>
      {({ filterData, products, loading, error }) => {

        const colors = Array.from(new Set(products.map((product) => product.color).filter(Boolean))).slice(0, 12);

        const filteredProducts = products.filter((product) => {
          if (urlFilters.color && product.color !== urlFilters.color) return false;
          if (urlFilters.material && product.material !== urlFilters.material) return false;
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

        const materials = filterData.materials.length
          ? filterData.materials
          : Array.from(new Set(products.map((product) => product.material))).filter(Boolean);

        const categoryOptions = categories;
        const materialOptions = materials;

        const priceInputs = parsePriceInputs(urlFilters.price);

        return (
          <section className={styles.page}>
            {/* Mobile bar — at page level so sticky doesn't overlap the grid */}
            <div className={styles.mobileBar}>
                  <button className={styles.mobileBarBtn} aria-label="Сортировка" onClick={() => setSortOpen(true)}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 5h14M5 10h10M7 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button className={styles.mobileBarBtn} aria-label="Фильтры" onClick={() => setModalOpen(true)}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="7" cy="5" r="2" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="13" cy="10" r="2" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="7" cy="15" r="2" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                  <div className={styles.mobileBarSep} />
                  <div className={styles.mobileChips}>
                    {urlFilters.category && (
                      <button
                        className={styles.mobileChipActive}
                        onClick={() => updateParam('category', null)}
                      >
                        {urlFilters.category} ×
                      </button>
                    )}
                    <button
                      className={urlFilters.inStock ? styles.mobileChipActive : styles.mobileChip}
                      onClick={() => {
                        const next = !urlFilters.inStock;
                        setFilters((prev) => ({ ...prev, inStock: next }));
                        setStockFilter(next);
                      }}
                    >
                      В наличии
                    </button>
                    <button
                      className={urlFilters.minRating === '4.5' ? styles.mobileChipActive : styles.mobileChip}
                      onClick={() => {
                        const next = urlFilters.minRating === '4.5' ? '' : '4.5';
                        setFilters((prev) => ({ ...prev, minRating: next }));
                        updateParam('minRating', next || null);
                      }}
                    >
                      ★ 4.5+
                    </button>
                    <button
                      className={urlFilters.minRating === '4' ? styles.mobileChipActive : styles.mobileChip}
                      onClick={() => {
                        const next = urlFilters.minRating === '4' ? '' : '4';
                        setFilters((prev) => ({ ...prev, minRating: next }));
                        updateParam('minRating', next || null);
                      }}
                    >
                      ★ 4.0+
                    </button>
                  </div>
                </div>

            <div className={styles.catalogLayout}>
              <aside className={styles.sidebar}>
                <div className={styles.sidebarHead}>
                  <h2>Все категории</h2>
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Сбросить
                  </Button>
                </div>

                <div className={styles.group}>
                  {categoryOptions.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={urlFilters.category === category ? styles.listItemActive : styles.listItem}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, category }));
                        updateParam('category', category);
                      }}
                    >
                      <span className={styles.optionBullet} aria-hidden="true" />
                      {category}
                    </button>
                  ))}
                </div>

                <div className={styles.group}>
                  <h3>Цена</h3>
                  <div className={styles.priceFields}>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="от"
                      value={priceInputs.min ?? ''}
                      onChange={(event) => {
                        const min = event.target.value ? Number(event.target.value) : null;
                        const nextPrice = normalizePriceFilter(min, priceInputs.max);
                        setFilters((prev) => ({ ...prev, price: nextPrice }));
                        updateParam('price', nextPrice || null);
                      }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="до"
                      value={priceInputs.max ?? ''}
                      onChange={(event) => {
                        const max = event.target.value ? Number(event.target.value) : null;
                        const nextPrice = normalizePriceFilter(priceInputs.min, max);
                        setFilters((prev) => ({ ...prev, price: nextPrice }));
                        updateParam('price', nextPrice || null);
                      }}
                    />
                  </div>
                </div>

                {colors.length > 0 ? (
                  <div className={styles.group}>
                    <h3>Цвет</h3>
                    <div className={styles.colorList}>
                      {colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={urlFilters.color === color ? styles.colorItemActive : styles.colorItem}
                          onClick={() => {
                            const nextColor = urlFilters.color === color ? '' : color;
                            setFilters((prev) => ({ ...prev, color: nextColor }));
                            updateParam('color', nextColor || null);
                          }}
                        >
                          <span
                            className={styles.colorDot}
                            style={{ backgroundColor: getColorSwatch(color) }}
                            aria-hidden="true"
                          />
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={styles.group}>
                  <h3>Материал пластика</h3>
                  <div className={styles.materialList}>
                    {materialOptions.map((material) => (
                      <button
                        key={material}
                        type="button"
                        className={urlFilters.material === material ? styles.listItemActive : styles.listItem}
                        onClick={() => {
                          const nextMaterial = urlFilters.material === material ? '' : material;
                          setFilters((prev) => ({ ...prev, material: nextMaterial }));
                          updateParam('material', nextMaterial || null);
                        }}
                      >
                        <span className={styles.optionBullet} aria-hidden="true" />
                        {material}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.group}>
                  <h3>Рейтинг</h3>
                  {[['4.5', '★★★★★ 4.5+'], ['4', '★★★★ 4.0+'], ['3', '★★★ 3.0+']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={urlFilters.minRating === value ? styles.listItemActive : styles.listItem}
                      onClick={() => {
                        const next = urlFilters.minRating === value ? '' : value;
                        setFilters((prev) => ({ ...prev, minRating: next }));
                        updateParam('minRating', next || null);
                      }}
                    >
                      <span className={styles.optionBullet} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>

                <label className={urlFilters.inStock ? styles.checkFieldActive : styles.checkField}>
                  <input
                    type="checkbox"
                    checked={urlFilters.inStock}
                    onChange={(event) => {
                      setFilters((prev) => ({ ...prev, inStock: event.target.checked }));
                      setStockFilter(event.target.checked);
                    }}
                  />
                  <span className={styles.checkIndicator} aria-hidden="true" />
                  Только в наличии
                </label>
              </aside>

              <main className={styles.content}>
                {/* Desktop sort row */}
                <div className={styles.controlsRow}>
                  <div className={styles.topControls}>
                    <Select
                      value={sort}
                      onChange={(event) => handleSortChange(event.target.value as SortValue)}
                    >
                      {Object.entries(sortOptions).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
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
              </main>
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

            {isSortOpen && (
              <div className={styles.sortOverlay} onClick={() => setSortOpen(false)}>
                <div className={styles.sortSheet} onClick={(e) => e.stopPropagation()}>
                  <p className={styles.sortSheetTitle}>Показывать сначала</p>
                  {Object.entries(sortOptions).map(([value, label]) => (
                    <button
                      key={value}
                      className={sort === value ? styles.sortOptionActive : styles.sortOption}
                      onClick={() => {
                        handleSortChange(value as SortValue);
                        setSortOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      <span className={sort === value ? styles.sortDotActive : styles.sortDot} />
                    </button>
                  ))}
                  <button className={styles.sortCancel} onClick={() => setSortOpen(false)}>
                    Отменить
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      }}
    </CatalogBoot>
  );
};

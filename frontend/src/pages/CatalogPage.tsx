import { useMemo, useState } from 'react';
import { ProductCard } from '../widgets/shop/ProductCard';
import { useCatalog } from '../features/catalog/useCatalog';
import { useFilters } from '../features/catalog/useFilters';
import styles from './CatalogPage.module.css';

export const CatalogPage = () => {
  const [filters, setFilters] = useState({
    category: '',
    material: '',
    price: '',
    size: ''
  });
  const filterData = useFilters();
  const { products, loading } = useCatalog({});

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchCategory = filters.category ? item.category === filters.category : true;
      const matchMaterial = filters.material ? item.material === filters.material : true;
      const matchSize = filters.size ? item.size === filters.size : true;
      const matchPrice = filters.price
        ? (() => {
            const [minRaw, maxRaw] = filters.price.split('-');
            const min = Number(minRaw);
            const max = Number(maxRaw);
            if (Number.isNaN(min) || Number.isNaN(max)) {
              return true;
            }
            return item.price >= min && item.price <= max;
          })()
        : true;

      return matchCategory && matchMaterial && matchSize && matchPrice;
    });
  }, [filters.category, filters.material, filters.price, filters.size, products]);

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Каталог моделей</h1>
            <p>Подберите готовые изделия от проверенных продавцов.</p>
          </div>
        </div>
        <div className={styles.filters}>
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                category: event.target.value
              }))
            }
            aria-label="Фильтр категории"
          >
            <option value="">Категория</option>
            {filterData.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={filters.material}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                material: event.target.value
              }))
            }
            aria-label="Фильтр материала"
          >
            <option value="">Материал</option>
            {filterData.materials.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
          <select
            value={filters.price}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                price: event.target.value
              }))
            }
            aria-label="Фильтр цены"
          >
            <option value="">Цена</option>
            <option value="0-2000">до 2 000 ₽</option>
            <option value="2000-5000">2 000 - 5 000 ₽</option>
            <option value="5000-10000">5 000 - 10 000 ₽</option>
          </select>
          <select
            value={filters.size}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                size: event.target.value
              }))
            }
            aria-label="Фильтр размера"
          >
            <option value="">Размер</option>
            {filterData.sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className={styles.loading}>Загрузка...</p>
        ) : (
          <div className={styles.grid}>
            {filteredProducts.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

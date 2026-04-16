import { Link } from 'react-router-dom';
import { Product } from '../../shared/types';
import { LandingProductCard } from './LandingProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import styles from '../LandingPage.module.css';

const CATEGORY_CHIPS = ['Фигурки', 'Декор', 'Запчасти', 'Прототипы', 'Подарки'];

type CatalogSectionProps = {
  products: Product[];
  loading: boolean;
  loadingMore?: boolean;
  error: string | null;
  activeCategory: string;
  onCategoryChange: (value: string) => void;
};

export const CatalogSection = ({
  products,
  loading,
  loadingMore = false,
  error,
  activeCategory,
  onCategoryChange
}: CatalogSectionProps) => (
  <section className={`${styles.catalogSection} container`}>
    <div className={styles.catalogHeader}>
      <h2 className={styles.sectionTitle}>Популярные категории</h2>
      <Link to="/catalog" className={styles.sectionLink}>
        Весь каталог
      </Link>
    </div>

    <div className={styles.categoryTabs}>
      {CATEGORY_CHIPS.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onCategoryChange(category)}
          className={
            activeCategory === category
              ? `${styles.categoryTab} ${styles.categoryTabActive}`
              : styles.categoryTab
          }
        >
          {category}
        </button>
      ))}
    </div>

    {loading ? (
      <div className={styles.productsGrid}>
        {Array.from({ length: 12 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    ) : error ? (
      <p className={styles.feedState}>Не удалось загрузить товары.</p>
    ) : (
      <>
        <div className={styles.productsGrid}>
          {products.map((product) => (
            <LandingProductCard product={product} key={product.id} />
          ))}
        </div>

        {loadingMore ? (
          <div className={styles.productsGrid}>
            {Array.from({ length: 6 }).map((_, index) => (
              <ProductCardSkeleton key={`more-${index}`} />
            ))}
          </div>
        ) : null}
      </>
    )}
  </section>
);
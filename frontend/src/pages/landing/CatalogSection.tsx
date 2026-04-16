import { Product } from '../../shared/types';
import { LandingProductCard } from './LandingProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import styles from '../LandingPage.module.css';

type CatalogSectionProps = {
  products: Product[];
  loading: boolean;
  loadingMore?: boolean;
  error: string | null;
};

export const CatalogSection = ({
  products,
  loading,
  loadingMore = false,
  error
}: CatalogSectionProps) => (
  <section className={`${styles.catalogSection} container`}>
    {loading ? (
      <div className={styles.productsGrid}>
        {Array.from({ length: 12 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    ) : error ? (
      <div className={styles.feedState}>
        <p>Не удалось загрузить товары.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Повторить
        </button>
      </div>
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

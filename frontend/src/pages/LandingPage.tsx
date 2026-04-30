import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { InfiniteCatalogBoot } from '../features/catalog/InfiniteCatalogBoot';
import { PromoCarouselSection } from './landing/LandingSections';
import { QuickCategories } from './landing/QuickCategories';
import { HomeProductCard } from './landing/HomeProductCard';
import { ProductCardSkeleton } from './landing/ProductCardSkeleton';
import type { Product } from '../shared/types';
import styles from './LandingPage.module.css';

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

type GridProps = {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasNextPage: boolean;
  fetchNextPage: () => void;
};

const ProductGrid = ({
  products,
  loading,
  loadingMore,
  error,
  hasNextPage,
  fetchNextPage,
}: GridProps) => {
  const navigate = useNavigate();
  const { ref, inView } = useInView({ threshold: 0, rootMargin: '600px 0px' });

  useEffect(() => {
    if (inView && hasNextPage && !loadingMore && !loading) fetchNextPage();
  }, [inView, hasNextPage, loadingMore, loading, fetchNextPage]);

  return (
    <section>
      <div className={styles.sectionH}>
        <h2 className={styles.sectionTitle}>Новинки каталога</h2>
        <button className={styles.sectionMore} onClick={() => navigate('/catalog')}>
          Смотреть все <ArrowIcon />
        </button>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className={styles.stateBox}>
          <p>Не удалось загрузить товары.</p>
          <button onClick={() => window.location.reload()}>Повторить</button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {products.map((p) => <HomeProductCard product={p} key={p.id} />)}
          </div>
          {loadingMore && (
            <div className={styles.grid} style={{ marginTop: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={`m-${i}`} />)}
            </div>
          )}
          {hasNextPage && <div ref={ref} style={{ height: 1 }} aria-hidden />}
        </>
      )}
    </section>
  );
};

export const LandingPage = () => {
  const filters = useMemo(() => ({ sort: 'createdAt' as const, order: 'desc' as const, limit: 20 }), []);

  return (
    <InfiniteCatalogBoot filters={filters}>
      {({ products, loading, loadingMore, error, hasNextPage, fetchNextPage }) => (
        <div className={styles.page}>
          <PromoCarouselSection />
          <QuickCategories />
          <ProductGrid
            products={products}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
          />
        </div>
      )}
    </InfiniteCatalogBoot>
  );
};

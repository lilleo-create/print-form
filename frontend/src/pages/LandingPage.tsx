import { useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { InfiniteCatalogBoot } from '../features/catalog/InfiniteCatalogBoot';
import {
  PromoCarouselSection,
  CatalogSection,
  StepsSection
} from './landing/LandingSections';
import styles from './LandingPage.module.css';
import { Product } from '../shared/types';

type LandingContentProps = {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasNextPage: boolean;
  fetchNextPage: () => void;
};

const LandingContent = ({
  products,
  loading,
  loadingMore,
  error,
  hasNextPage,
  fetchNextPage,
}: LandingContentProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '600px 0px'
  });

  useEffect(() => {
    if (inView && hasNextPage && !loadingMore && !loading) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, loadingMore, loading, fetchNextPage]);

  return (
    <div className={styles.page}>
      <PromoCarouselSection />

      <CatalogSection
        products={products}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
      />

      {hasNextPage ? (
        <div ref={ref} className={styles.loadMoreTrigger} aria-hidden="true" />
      ) : null}

      <StepsSection />
    </div>
  );
};

export const LandingPage = () => {
  const catalogFilters = useMemo(
    () => ({
      sort: 'createdAt' as const,
      order: 'desc' as const,
      limit: 18
    }),
    []
  );

  return (
    <InfiniteCatalogBoot filters={catalogFilters}>
      {({ products, loading, loadingMore, error, hasNextPage, fetchNextPage }) => (
        <LandingContent
          products={products}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}
    </InfiniteCatalogBoot>
  );
};

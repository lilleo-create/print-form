import { useMemo, useState } from 'react';
import { CatalogBoot } from '../features/catalog/CatalogBoot';
import {
  AudienceSection,
  CatalogSection,
  FinalCtaSection,
  HeroSection,
  StepsSection,
  TrustSection,
  UploadSection
} from './landing/LandingSections';
import styles from './LandingPage.module.css';

export const LandingPage = () => {
  const [activeCategory, setActiveCategory] = useState('Фигурки');
  const catalogBootFilters = useMemo(
    () => ({
      category: activeCategory,
      sort: 'rating' as const,
      order: 'desc' as const,
      limit: 8
    }),
    [activeCategory]
  );

  return (
    <CatalogBoot filters={catalogBootFilters}>
      {({ products, loading, error }) => (
        <div className={styles.page}>
          <HeroSection />
          <CatalogSection
            products={products.slice(0, 8)}
            loading={loading}
            error={error}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <UploadSection />
          <StepsSection />
          <AudienceSection />
          <TrustSection />
          <FinalCtaSection />
        </div>
      )}
    </CatalogBoot>
  );
};

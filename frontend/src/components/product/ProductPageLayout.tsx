import { useMemo } from 'react';
import type { Product } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';
import { useProduct } from '../../hooks/useProduct';
import { useProductReviews } from '../../hooks/useProductReviews';
import { useProductBoard } from '../../hooks/useProductBoard';
import { toProductImageList } from '../../shared/lib/productMedia';
import { ProductGallery } from './ProductGallery';
import { ProductDetails } from './ProductDetails';
import { ProductReviewsPreview } from './ProductReviewsPreview';
import { ProductFeed } from './ProductFeed';
import {
  ProductSpecs,
  type SpecItem
} from '../../pages/ProductPage/components/ProductSpecs/ProductSpecs';

const normalizeProductSpecs = (product: Product | null): SpecItem[] => {
  if (!product) return [];

  const specs = product.specs?.length
    ? product.specs.map((spec) => ({ name: spec.key, value: spec.value }))
    : [];

  if (specs.length > 0) {
    return specs.filter((item) => item.name && item.value);
  }

  const attributes = (product as Product & { attributes?: Array<{ key?: string; name?: string; value?: string }> }).attributes;
  if (Array.isArray(attributes) && attributes.length > 0) {
    return attributes
      .map((item) => ({ name: item.name ?? item.key ?? '', value: item.value ?? '' }))
      .filter((item) => item.name && item.value);
  }

  const characteristics = (product as Product & { characteristics?: Record<string, string> }).characteristics;
  if (characteristics && typeof characteristics === 'object') {
    return Object.entries(characteristics)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.name && item.value);
  }

  return [
    { name: 'Материал', value: (product as { material?: string }).material ?? '' },
    { name: 'Технология', value: (product as { technology?: string }).technology ?? '' },
    { name: 'Время печати', value: (product as { printTime?: string }).printTime ?? '' },
    { name: 'Цвет', value: (product as { color?: string }).color ?? '' }
  ].filter((item) => item.value);
};

type ProductPageLayoutProps = {
  productId: string;
};

export const ProductPageLayout = ({ productId }: ProductPageLayoutProps) => {
  const { data: product, status, error } = useProduct(productId, { keepPreviousData: true });
  const { reviews, summary } = useProductReviews(productId, { keepPreviousData: true });

  useProductBoard(product);

  const specs = useMemo(() => normalizeProductSpecs(product), [product]);

  if (status === 'loading' && !product) {
    return (
      <section className={styles.page}>
        <div className={styles.container}>
          <p>Загрузка...</p>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className={styles.page}>
        <div className={styles.container}>
          <p>{error ?? 'Товар не найден.'}</p>
        </div>
      </section>
    );
  }

  const productImages = toProductImageList(product);
  const reviewsCount = summary?.total ?? 0;
  const ratingCount = product.ratingCount ?? reviewsCount;

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.leftCol}>
            <ProductGallery images={productImages} title={product.title} />
          </div>
          <div className={styles.rightCol}>
            <ProductDetails product={product} ratingCount={ratingCount} reviewsCount={reviewsCount} />
          </div>
        </div>

        <div className={styles.sections}>
          <div className={styles.description}>
            <h2>Описание</h2>
            <p>{product.descriptionFull ?? product.description}</p>
          </div>
          <ProductSpecs items={specs} isLoading={status === 'loading'} />
        </div>

        <ProductReviewsPreview productId={product.id} product={product} reviews={reviews} summary={summary} />

        <ProductFeed productId={product.id} />
      </div>
    </section>
  );
};

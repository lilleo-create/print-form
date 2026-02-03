import type { ProductImage } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';
import { useProduct } from '../../hooks/useProduct';
import { useProductReviews } from '../../hooks/useProductReviews';
import { useProductBoard } from '../../hooks/useProductBoard';
import { ProductGallery } from './ProductGallery';
import { ProductDetails } from './ProductDetails';
import { ProductSpecs } from './ProductSpecs';
import { ProductReviewsPreview } from './ProductReviewsPreview';
import { ProductFeed } from './ProductFeed';

const getProductImages = (product: { images?: ProductImage[]; image?: string }): ProductImage[] => {
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  return [{ id: 'main', url: (product as any).image, sortOrder: 0 }];
};

type ProductPageLayoutProps = {
  productId: string;
};

export const ProductPageLayout = ({ productId }: ProductPageLayoutProps) => {
  const { data: product, status, error } = useProduct(productId, { keepPreviousData: true });
  const { reviews, summary } = useProductReviews(productId, { keepPreviousData: true });

  useProductBoard(product);

  if (status === 'loading' && !product) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>Загрузка...</p>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>{error ?? 'Товар не найден.'}</p>
        </div>
      </section>
    );
  }

  const productImages = getProductImages(product);
  const reviewsCount = summary?.total ?? 0;
  const ratingCount = product.ratingCount ?? reviewsCount;

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <ProductGallery images={productImages} title={product.title} />
          <ProductDetails product={product} ratingCount={ratingCount} reviewsCount={reviewsCount} />
        </div>

        <ProductSpecs product={product} />

        <ProductReviewsPreview productId={product.id} reviews={reviews} summary={summary} />

        <ProductFeed productId={product.id} />
      </div>
    </section>
  );
};

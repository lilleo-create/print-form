import { Skeleton } from '../../shared/ui/Skeleton';
import styles from '../LandingPage.module.css';

export const ProductCardSkeleton = () => (
  <article className={styles.productCard}>
    <Skeleton className={styles.productImageSkeleton} />
    <div className={styles.productBody}>
      <Skeleton className={styles.productTitleSkeleton} />
      <Skeleton className={styles.productPriceSkeleton} />
      <Skeleton className={styles.productMetaSkeleton} />
    </div>
  </article>
);
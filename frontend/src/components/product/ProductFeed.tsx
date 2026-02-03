import { ProductCard } from '../../widgets/shop/ProductCard';
import styles from '../../pages/ProductPage.module.css';
import { useProductFeed } from '../../hooks/useProductFeed';

type ProductFeedProps = {
  productId: string;
};

export const ProductFeed = ({ productId }: ProductFeedProps) => {
  const { items, status, sentinelRef } = useProductFeed({ productId });

  return (
    <div className={styles.feed}>
      <h2>Ещё товары</h2>
      <div className={styles.feedGrid}>
        {items.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>

      {status === 'loading' && <p className={styles.loading}>Загрузка...</p>}

      <div ref={sentinelRef} />
    </div>
  );
};

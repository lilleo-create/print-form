import { Link } from 'react-router-dom';
import { SmartImage } from '../../shared/ui/SmartImage';
import { Product } from '../../shared/types';
import { formatPriceNoKopecks } from '../../shared/lib/formatPrice';
import styles from '../LandingPage.module.css';

type LandingProductCardProps = {
  product: Product;
};

const formatLandingPrice = (price?: number | null) => {
  if (typeof price !== 'number' || Number.isNaN(price)) {
    return 'Цена по запросу';
  }

  return formatPriceNoKopecks(price);
};

export const LandingProductCard = ({ product }: LandingProductCardProps) => {
  const image = product.images?.[0]?.url || product.image || null;

  return (
    <article className={styles.productCard}>
      <Link to={`/product/${product.id}`} className={styles.productImageLink}>
        <SmartImage
          src={image}
          alt={product.title}
          className={styles.productImage}
          skeletonClassName={styles.productImageSkeleton}
          sizePreset="card"
        />
      </Link>

      <div className={styles.productBody}>
        <Link to={`/product/${product.id}`} className={styles.productTitle}>
          {product.title}
        </Link>

        <div className={styles.productPrice}>{formatLandingPrice(product.price)}</div>

        {product.ratingAvg ? (
          <div className={styles.productMeta}>
            ★ {product.ratingAvg.toFixed(1)}
            {product.ratingCount ? ` · ${product.ratingCount}` : ''}
          </div>
        ) : (
          <div className={styles.productMeta}>Готово к заказу</div>
        )}
      </div>
    </article>
  );
};
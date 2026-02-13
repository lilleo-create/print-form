import { Link } from 'react-router-dom';
import type { Product } from '../../../shared/types';
import { Rating } from '../../../shared/ui/Rating';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { getProductPrimaryImage } from '../../../shared/lib/getProductPrimaryImage';
import styles from './ReviewsSummary.module.css';

type Summary = {
  total: number;
  avg: number;
  counts: { rating: number; count: number }[];
};

type ReviewsSummaryProps = {
  summary: Summary | null;
  total: number;
  onAction: () => void;
  actionLabel: string;
  canReview: boolean;
  product: Product;
};

export const ReviewsSummary = ({ summary, total, onAction, actionLabel, canReview, product }: ReviewsSummaryProps) => {
  const avgValue = summary?.avg ?? 0;
  const distribution = summary?.counts ?? [];
  const productImageSrc = resolveImageUrl(getProductPrimaryImage(product));
  const shopId = product.sellerId;

  return (
    <section className={styles.card}>
      <div className={styles.productCard}>
        {productImageSrc ? (
          <img src={productImageSrc} alt={product.title} className={styles.productThumb} />
        ) : (
          <div className={styles.productPlaceholder}>Нет изображения</div>
        )}
        <div className={styles.productInfo}>
          <p className={styles.productLabel}>Товар</p>
          <p className={styles.productTitle}>{product.title}</p>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <span className={styles.value}>{avgValue.toFixed(1)}</span>
          <p className={styles.caption}>{total} оценок</p>
        </div>
        <div className={styles.stars}>
          <Rating value={avgValue} count={total} size="md" />
        </div>
      </div>
      <ul className={styles.distribution}>
        {distribution.map((item) => (
          <li key={item.rating}>
            <span>{item.rating}★</span>
            <div className={styles.bar}>
              <div
                className={styles.barFill}
                style={{ width: total ? `${(item.count / total) * 100}%` : '0%' }}
              />
            </div>
            <span>{item.count}</span>
          </li>
        ))}
      </ul>
      {shopId ? (
        <Link to={`/shop/${shopId}`} className={styles.shopBadge}>
          <div className={styles.shopAvatar} aria-hidden>
            🏪
          </div>
          <div>
            <p className={styles.shopName}>Магазин</p>
            <p className={styles.shopMeta}>Рейтинг {avgValue.toFixed(1)}</p>
          </div>
        </Link>
      ) : (
        <div className={`${styles.shopBadge} ${styles.shopBadgeDisabled}`}>
          <div className={styles.shopAvatar} aria-hidden>
            🏪
          </div>
          <div>
            <p className={styles.shopName}>Магазин недоступен</p>
            <p className={styles.shopMeta}>Нет данных</p>
          </div>
        </div>
      )}
      {canReview && (
        <button type="button" className={styles.reviewButton} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
};

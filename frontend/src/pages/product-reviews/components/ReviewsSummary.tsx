import type { Product } from '../../../shared/types';
import { Rating } from '../../../shared/ui/Rating';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { getProductPrimaryImage } from '../../../shared/lib/getProductPrimaryImage';
import styles from './ReviewsSummary.module.css';

type ReviewSummaryData = {
  total?: number;
  avg?: number;
  counts?: { rating: number; count: number }[];
} | null;

type ReviewsSummaryProps = {
  product: Product | null;
  summary: ReviewSummaryData;
  total: number;
  canReview: boolean;
  actionLabel: string;
  onAction: () => void;
};

const pluralReviews = (n: number) => {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} отзыв`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} отзыва`;
  return `${n} отзывов`;
};

export const ReviewsSummary = ({ product, summary, total, canReview, actionLabel, onAction }: ReviewsSummaryProps) => {
  const avg = summary?.avg ?? 0;
  const counts = summary?.counts ?? [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }));
  const productImageSrc = product ? resolveImageUrl(getProductPrimaryImage(product)) : '';

  return (
    <div className={styles.card}>
      {product && (
        <div className={styles.productCard}>
          {productImageSrc ? (
            <img src={productImageSrc} alt={product.title} className={styles.productThumb} />
          ) : (
            <div className={styles.productPlaceholder}>Нет фото</div>
          )}
          <div className={styles.productInfo}>
            <p className={styles.productLabel}>Товар</p>
            <p className={styles.productTitle}>{product.title}</p>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div>
          <span className={styles.value}>{avg > 0 ? avg.toFixed(1) : '—'}</span>
          <p className={styles.caption}>{pluralReviews(total)}</p>
        </div>
        <div className={styles.stars}>
          <Rating value={avg} count={0} size="md" />
        </div>
      </div>

      <ul className={styles.distribution}>
        {counts.map((item) => (
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

      {canReview && (
        <button type="button" onClick={onAction} className={styles.reviewButton}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

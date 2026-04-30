import type { Product } from '../../../shared/types';
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

export const ReviewsSummary = ({ product, summary, total, canReview, actionLabel, onAction }: ReviewsSummaryProps) => {
  const avg = summary?.avg ?? 0;

  return (
    <div className={styles.wrap}>
      {product && (
        <div className={styles.product}>
          <strong>{product.title}</strong>
        </div>
      )}
      <div className={styles.score}>
        <span className={styles.value}>{avg > 0 ? avg.toFixed(1) : '—'}</span>
        <span className={styles.label}>{total} отзывов</span>
      </div>
      {canReview && (
        <button type="button" onClick={onAction} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

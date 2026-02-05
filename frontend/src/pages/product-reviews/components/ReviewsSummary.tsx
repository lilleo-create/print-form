import { Rating } from '../../../shared/ui/Rating';
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
};

export const ReviewsSummary = ({ summary, total, onAction, actionLabel, canReview }: ReviewsSummaryProps) => {
  const avgValue = summary?.avg ?? 0;
  const distribution = summary?.counts ?? [];

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.value}>{avgValue.toFixed(1)}</span>
          <p className={styles.caption}>{total} оценок</p>
        </div>
        <div className={styles.stars}>
          <Rating value={avgValue} count={total} size="lg" />
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
      {canReview && (
        <button type="button" className={styles.reviewButton} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
};

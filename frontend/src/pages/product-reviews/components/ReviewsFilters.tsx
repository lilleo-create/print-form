import type { Dispatch, SetStateAction } from 'react';
import type { ReviewScope, ReviewFilters } from '../hooks/useProductReviews';
import styles from './ReviewsFilters.module.css';

type ReviewsFiltersProps = {
  scope: ReviewScope;
  onScopeChange: Dispatch<SetStateAction<ReviewScope>>;
  filters: ReviewFilters;
  onFiltersChange: Dispatch<SetStateAction<ReviewFilters>>;
};

export const ReviewsFilters = ({ scope, onScopeChange, filters, onFiltersChange }: ReviewsFiltersProps) => (
  <div className={styles.filters}>
    {(['all', 'variant'] as ReviewScope[]).map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onScopeChange(s)}
        className={`${styles.scopeBtn} ${scope === s ? styles.scopeBtnActive : ''}`}
      >
        {s === 'all' ? 'Все отзывы' : 'На этот вариант'}
      </button>
    ))}
    <label className={styles.checkLabel}>
      <input
        type="checkbox"
        checked={filters.withMedia}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, withMedia: e.target.checked }))}
      />
      С фото
    </label>
    <label className={styles.checkLabel}>
      <input
        type="checkbox"
        checked={filters.helpful}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, helpful: e.target.checked }))}
      />
      Полезные
    </label>
  </div>
);

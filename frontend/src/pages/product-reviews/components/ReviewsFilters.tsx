import type { Dispatch, SetStateAction } from 'react';
import type { ReviewScope, ReviewFilters } from '../hooks/useProductReviews';

type ReviewsFiltersProps = {
  scope: ReviewScope;
  onScopeChange: Dispatch<SetStateAction<ReviewScope>>;
  filters: ReviewFilters;
  onFiltersChange: Dispatch<SetStateAction<ReviewFilters>>;
};

export const ReviewsFilters = ({ scope, onScopeChange, filters, onFiltersChange }: ReviewsFiltersProps) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    {(['all', 'variant'] as ReviewScope[]).map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onScopeChange(s)}
        style={{
          padding: '6px 14px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: scope === s ? 'var(--primary)' : 'var(--bg-2)',
          color: scope === s ? '#fff' : 'var(--text)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500
        }}
      >
        {s === 'all' ? 'Все отзывы' : 'На этот вариант'}
      </button>
    ))}
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={filters.withMedia}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, withMedia: e.target.checked }))}
      />
      С фото
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={filters.helpful}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, helpful: e.target.checked }))}
      />
      Полезные
    </label>
  </div>
);

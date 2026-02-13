import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewFilters, ReviewScope } from '../hooks/useProductReviews';
import styles from './ReviewsFilters.module.css';

type ReviewsFiltersProps = {
  scope: ReviewScope;
  onScopeChange: (scope: ReviewScope) => void;
  filters: ReviewFilters;
  onFiltersChange: (filters: ReviewFilters) => void;
};

const filterItems: { key: keyof ReviewFilters; label: string }[] = [
  { key: 'helpful', label: 'Полезные' },
  { key: 'withMedia', label: 'С фото и видео' },
  { key: 'high', label: 'С высокой оценкой' },
  { key: 'low', label: 'С низкой оценкой' },
  { key: 'new', label: 'Новые' }
];

export const ReviewsFilters = ({ scope, onScopeChange, filters, onFiltersChange }: ReviewsFiltersProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeCount = useMemo(
    () => filterItems.filter((item) => item.key !== 'new' && filters[item.key]).length,
    [filters]
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleToggle = (key: keyof ReviewFilters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  return (
    <div className={styles.row}>
      <div className={styles.scopes}>
        <button
          type="button"
          className={scope === 'all' ? styles.scopeActive : styles.scopeButton}
          onClick={() => onScopeChange('all')}
        >
          Все отзывы
        </button>
        <button
          type="button"
          className={scope === 'variant' ? styles.scopeActive : styles.scopeButton}
          onClick={() => onScopeChange('variant')}
        >
          Этот вариант
        </button>
      </div>

      <div className={styles.dropdown} ref={rootRef}>
        <button type="button" className={styles.dropdownButton} onClick={() => setOpen((prev) => !prev)}>
          Фильтры{activeCount ? ` (${activeCount})` : ''}
          <span className={styles.dropdownIcon}>▾</span>
        </button>
        {open && (
          <div className={styles.dropdownMenu} role="menu">
            {filterItems.map((item) => (
              <label key={item.key} className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={filters[item.key]}
                  onChange={() => handleToggle(item.key)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

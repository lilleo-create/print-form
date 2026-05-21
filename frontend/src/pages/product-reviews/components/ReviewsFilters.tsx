import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReviewScope, ReviewFilters } from '../hooks/useProductReviews';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import styles from './ReviewsFilters.module.css';

type ReviewsFiltersProps = {
  scope: ReviewScope;
  onScopeChange: Dispatch<SetStateAction<ReviewScope>>;
  filters: ReviewFilters;
  onFiltersChange: Dispatch<SetStateAction<ReviewFilters>>;
  allPhotos: string[];
  onPhotoClick: (photos: string[], index: number) => void;
};

type SortKey = 'helpful' | 'high' | 'low' | 'new';

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Полезные', key: 'helpful' },
  { label: 'С высокой оценкой', key: 'high' },
  { label: 'С низкой оценкой', key: 'low' },
  { label: 'Новые', key: 'new' },
];

const getCurrentSort = (filters: ReviewFilters): SortKey => {
  if (filters.helpful) return 'helpful';
  if (filters.high) return 'high';
  if (filters.low) return 'low';
  return 'new';
};

const getSortLabel = (key: SortKey) =>
  SORT_OPTIONS.find((o) => o.key === key)?.label ?? 'Новые';

export const ReviewsFilters = ({
  scope,
  onScopeChange,
  filters,
  onFiltersChange,
  allPhotos,
  onPhotoClick,
}: ReviewsFiltersProps) => {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const currentSort = getCurrentSort(filters);

  const setSort = (key: SortKey) => {
    onFiltersChange((prev) => ({
      ...prev,
      helpful: key === 'helpful',
      high: key === 'high',
      low: key === 'low',
      new: key === 'new',
    }));
    setSortOpen(false);
  };

  return (
    <div className={styles.wrap}>
      {/* Scope tabs */}
      <div className={styles.tabs}>
        {(['all', 'variant'] as ReviewScope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onScopeChange(s)}
            className={`${styles.tab} ${scope === s ? styles.tabActive : ''}`}
          >
            {s === 'all' ? 'Все отзывы' : 'Этот вариант'}
          </button>
        ))}
      </div>

      {/* Photo gallery */}
      {allPhotos.length > 0 && (
        <div className={styles.gallery}>
          {allPhotos.map((photo, i) => (
            <button
              key={`${photo}-${i}`}
              type="button"
              className={styles.galleryItem}
              onClick={() => onPhotoClick(allPhotos, i)}
            >
              <img src={resolveImageUrl(photo)} alt="Фото отзыва" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Pills row */}
      <div className={styles.pills}>
        {/* Sort dropdown */}
        <div className={styles.sortWrap} ref={sortRef}>
          <button
            type="button"
            className={`${styles.pill} ${currentSort !== 'new' ? styles.pillActive : ''}`}
            onClick={() => setSortOpen((v) => !v)}
          >
            <span className={styles.sortIcon}>≡</span>
            {getSortLabel(currentSort)}
          </button>

          {sortOpen && (
            <div className={styles.dropdown}>
              <p className={styles.dropdownHeader}>Показывать сначала</p>
              {SORT_OPTIONS.map((opt) => {
                const active = currentSort === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={styles.dropdownOption}
                    onClick={() => setSort(opt.key)}
                  >
                    <span>{opt.label}</span>
                    <span className={`${styles.radioCircle} ${active ? styles.radioCircleActive : ''}`}>
                      {active && <span className={styles.radioDot} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* withMedia toggle */}
        <button
          type="button"
          className={`${styles.pill} ${filters.withMedia ? styles.pillActive : ''}`}
          onClick={() => onFiltersChange((p) => ({ ...p, withMedia: !p.withMedia }))}
        >
          С фото и видео
        </button>
      </div>
    </div>
  );
};

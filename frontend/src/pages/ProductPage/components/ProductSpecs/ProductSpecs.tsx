import { useMemo, useState } from 'react';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import styles from './ProductSpecs.module.css';

export type SpecItem = { name: string; value: string };

interface ProductSpecsProps {
  items: SpecItem[];
  isLoading?: boolean;
}

const PREVIEW_LIMIT = 8;

export const ProductSpecs = ({ items, isLoading = false }: ProductSpecsProps) => {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = useMemo(() => {
    if (expanded) return items;
    return items.slice(0, PREVIEW_LIMIT);
  }, [expanded, items]);

  return (
    <section className={styles.specsSection}>
      <h2>Характеристики</h2>

      {isLoading ? (
        <div className={styles.skeletonList}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} style={{ width: '100%', height: 24 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Характеристики не указаны</p>
      ) : (
        <>
          <ul className={styles.list}>
            {visibleItems.map((item, index) => (
              <li key={`${item.name}-${index}`} className={styles.row}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.value}>{item.value}</span>
              </li>
            ))}
          </ul>

          {items.length > PREVIEW_LIMIT ? (
            <button type="button" className={styles.toggle} onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Скрыть' : 'Показать все'}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
};

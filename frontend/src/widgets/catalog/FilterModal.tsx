import { useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import styles from './FilterModal.module.css';

interface FilterModalProps {
  isOpen: boolean;
  filters: {
    material: string;
    size: string;
  };
  filterOptions: {
    materials: string[];
    sizes: string[];
  };
  onChange: (key: 'material' | 'size', value: string) => void;
  onApply: () => void;
  onClose: () => void;
}

export const FilterModal = ({
  isOpen,
  filters,
  filterOptions,
  onChange,
  onApply,
  onClose
}: FilterModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, modalRef);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} ref={modalRef} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <h2>Фильтры</h2>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть фильтр">
            ✕
          </button>
        </header>
        <div className={styles.content}>
          <label className={styles.field}>
            Материал
            <select
              value={filters.material}
              onChange={(event) => onChange('material', event.target.value)}
            >
              <option value="">Все</option>
              {filterOptions.materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Размер
            <select value={filters.size} onChange={(event) => onChange('size', event.target.value)}>
              <option value="">Все</option>
              {filterOptions.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={onApply}>Применить</Button>
        </div>
      </div>
    </div>
  );
};

import { useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import styles from './FilterModal.module.css';

interface FilterModalProps {
  isOpen: boolean;
  filters: {
    category: string;
    material: string;
    price: string;
  };
  filterOptions: {
    categories: string[];
    materials: string[];
  };
  onChange: (key: 'category' | 'material' | 'price', value: string) => void;
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
          <h2>Фильтр</h2>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть фильтр">
            ✕
          </button>
        </header>
        <div className={styles.content}>
          <label className={styles.field}>
            Категория
            <select
              value={filters.category}
              onChange={(event) => onChange('category', event.target.value)}
            >
              <option value="">Все</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
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
            Цена
            <select value={filters.price} onChange={(event) => onChange('price', event.target.value)}>
              <option value="">Любая</option>
              <option value="0-2000">до 2 000 ₽</option>
              <option value="2000-5000">2 000 - 5 000 ₽</option>
              <option value="5000-10000">5 000 - 10 000 ₽</option>
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

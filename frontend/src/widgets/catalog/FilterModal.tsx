import { useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';
import { useOverlayClose } from '../../shared/lib/useOverlayClose';
import styles from './FilterModal.module.css';

interface FilterModalProps {
  isOpen: boolean;
  filters: {
    category: string;
    material: string;
    price: string;
    color: string;
    minRating: string;
    inStock: boolean;
  };
  filterOptions: {
    categories: string[];
    materials: string[];
    colors: string[];
  };
  onChange: (key: 'category' | 'material' | 'price' | 'color' | 'minRating', value: string) => void;
  onToggleStock: (next: boolean) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const FilterModal = ({
  isOpen,
  filters,
  filterOptions,
  onChange,
  onToggleStock,
  onApply,
  onReset,
  onClose
}: FilterModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, modalRef);
  useBodyScrollLock(isOpen);

  const { handlePointerDown, handleClick } = useOverlayClose(onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onPointerDown={handlePointerDown} onClick={handleClick}>
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
              <option value="0-1000">до 1 000 ₽</option>
              <option value="1000-3000">1 000 - 3 000 ₽</option>
              <option value="3000-7000">3 000 - 7 000 ₽</option>
              <option value="7000-">от 7 000 ₽</option>
            </select>
          </label>

          {filterOptions.colors.length > 0 ? (
            <label className={styles.field}>
              Цвет
              <select value={filters.color} onChange={(event) => onChange('color', event.target.value)}>
                <option value="">Любой</option>
                {filterOptions.colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={styles.field}>
            Минимальный рейтинг
            <select value={filters.minRating} onChange={(event) => onChange('minRating', event.target.value)}>
              <option value="">Любой</option>
              <option value="4">4.0+</option>
              <option value="3">3.0+</option>
            </select>
          </label>

          <label className={styles.checkbox}>
            <input type="checkbox" checked={filters.inStock} onChange={(event) => onToggleStock(event.target.checked)} />
            Только в наличии
          </label>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onReset}>
            Сбросить
          </Button>
          <Button onClick={onApply}>Применить</Button>
        </div>
      </div>
    </div>
  );
};

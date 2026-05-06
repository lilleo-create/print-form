import { useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';
import { useOverlayClose } from '../../shared/lib/useOverlayClose';
import styles from './FilterModal.module.css';

const COLOR_SWATCHES: Record<string, string> = {
  white: '#e8ecf4', 'белый': '#e8ecf4',
  black: '#111315', 'черный': '#111315', 'чёрный': '#111315',
  gray: '#9fa8b8', 'серый': '#9fa8b8',
  beige: '#d4b89c', 'бежевый': '#d4b89c',
  blue: '#4d70ff', 'синий': '#4d70ff',
  red: '#dd4e53', 'красный': '#dd4e53',
  green: '#48aa63', 'зеленый': '#48aa63', 'зелёный': '#48aa63',
  yellow: '#eabf3f', 'желтый': '#eabf3f', 'жёлтый': '#eabf3f',
  orange: '#ef8a3a', 'оранжевый': '#ef8a3a',
  pink: '#d67ac3', 'розовый': '#d67ac3'
};
const getColorSwatch = (name: string) => COLOR_SWATCHES[name.trim().toLowerCase()] ?? '#b8becb';

const parsePriceInputs = (price: string) => {
  const [minRaw = '', maxRaw = ''] = price.split('-');
  return { min: minRaw, max: maxRaw };
};

const buildPriceString = (min: string, max: string) => {
  if (min && max) return `${min}-${max}`;
  if (min) return `${min}-`;
  if (max) return `-${max}`;
  return '';
};

const RATING_OPTIONS: Array<[string, string]> = [
  ['4.5', '★ 4.5+'],
  ['4', '★ 4.0+'],
  ['3', '★ 3.0+']
];

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

  if (!isOpen) return null;

  const price = parsePriceInputs(filters.price);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onPointerDown={handlePointerDown} onClick={handleClick}>
      <div className={styles.modal} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.headerTitle}>Фильтры</h2>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть">✕</button>
        </header>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Цена, ₽</h3>
            <div className={styles.priceRow}>
              <input
                className={styles.priceInput}
                type="number"
                inputMode="numeric"
                placeholder="от"
                value={price.min}
                onChange={(e) => onChange('price', buildPriceString(e.target.value, price.max))}
              />
              <input
                className={styles.priceInput}
                type="number"
                inputMode="numeric"
                placeholder="до"
                value={price.max}
                onChange={(e) => onChange('price', buildPriceString(price.min, e.target.value))}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Рейтинг</h3>
            <div className={styles.chips}>
              {RATING_OPTIONS.map(([val, label]) => (
                <button
                  key={val}
                  className={filters.minRating === val ? styles.chipActive : styles.chip}
                  onClick={() => onChange('minRating', filters.minRating === val ? '' : val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filterOptions.materials.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Материал</h3>
              <div className={styles.chips}>
                {filterOptions.materials.map((m) => (
                  <button
                    key={m}
                    className={filters.material === m ? styles.chipActive : styles.chip}
                    onClick={() => onChange('material', filters.material === m ? '' : m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filterOptions.colors.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Цвет</h3>
              <div className={styles.chips}>
                {filterOptions.colors.map((c) => (
                  <button
                    key={c}
                    className={filters.color === c ? styles.chipColorActive : styles.chipColor}
                    onClick={() => onChange('color', filters.color === c ? '' : c)}
                  >
                    <span className={styles.chipColorDot} style={{ backgroundColor: getColorSwatch(c) }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filterOptions.categories.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Категория</h3>
              <div className={styles.chips}>
                {filterOptions.categories.map((cat) => (
                  <button
                    key={cat}
                    className={filters.category === cat ? styles.chipActive : styles.chip}
                    onClick={() => onChange('category', filters.category === cat ? '' : cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Только в наличии</span>
            <button
              role="switch"
              aria-checked={filters.inStock}
              className={filters.inStock ? styles.toggleOn : styles.toggleOff}
              onClick={() => onToggleStock(!filters.inStock)}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={onReset}>Сбросить</button>
          <Button className={styles.applyBtn} onClick={onApply}>Показать товары</Button>
        </div>
      </div>
    </div>
  );
};

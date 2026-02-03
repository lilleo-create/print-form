import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../layout/Layout.module.css';

interface CatalogHeaderProps {
  categories: string[];
  activeCategory: string;
  onSelect: (category?: string) => void;
}

export const CatalogHeader = ({
  categories,
  activeCategory,
  onSelect
}: CatalogHeaderProps) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('catalog-category-buttons'));
  }, []);

  if (!target) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className={!activeCategory ? styles.categoryActive : styles.categoryButton}
        onClick={() => onSelect('')}
      >
        Все категории
      </button>
      {categories.map((category) => (
        <button
          type="button"
          key={category}
          className={activeCategory === category ? styles.categoryActive : styles.categoryButton}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </>,
    target
  );
};

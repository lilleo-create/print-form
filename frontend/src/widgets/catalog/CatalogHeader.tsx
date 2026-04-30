import styles from './CatalogHeader.module.css';

type CatalogHeaderProps = {
  categories: string[];
  activeCategory: string;
  onSelect: (category?: string) => void;
};

export const CatalogHeader = ({ categories, activeCategory, onSelect }: CatalogHeaderProps) => {
  if (!categories.length) return null;

  return (
    <nav className={styles.wrap} aria-label="Категории каталога">
      <div className={`${styles.inner} container`}>
        <button
          type="button"
          className={!activeCategory ? styles.pillActive : styles.pill}
          onClick={() => onSelect(undefined)}
        >
          Все категории
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category ? styles.pillActive : styles.pill}
            onClick={() => onSelect(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </nav>
  );
};

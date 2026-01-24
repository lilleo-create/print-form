import { useNavigate } from 'react-router-dom';
import { useFilters } from '../features/catalog/useFilters';
import styles from './CategoriesPage.module.css';

export const CategoriesPage = () => {
  const navigate = useNavigate();
  const { categories } = useFilters();

  const handleSelect = (category?: string) => {
    if (category) {
      navigate(`/catalog?category=${encodeURIComponent(category)}`);
    } else {
      navigate('/catalog');
    }
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
            ←
          </button>
          <h1>Категории</h1>
        </div>
        {categories.length === 0 ? (
          <p className={styles.empty}>Категории пока не загружены.</p>
        ) : (
          <div className={styles.grid}>
            <button type="button" className={styles.card} onClick={() => handleSelect()}>
              <span className={styles.cardIcon} aria-hidden>
                ⭐
              </span>
              <span className={styles.cardTitle}>Все категории</span>
              <span className={styles.cardMeta}>Смотреть товары →</span>
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={styles.card}
                onClick={() => handleSelect(category)}
              >
                <span className={styles.cardIcon} aria-hidden>
                  🧩
                </span>
                <span className={styles.cardTitle}>{category}</span>
                <span className={styles.cardMeta}>Смотреть товары →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

import { useNavigate } from 'react-router-dom';
import { useFilters } from '../features/catalog/useFilters';
import styles from './CategoriesPage.module.css';

export const CategoriesPage = () => {
  const navigate = useNavigate();
  const { categories } = useFilters();

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Категории</h1>
          <p>Выберите раздел и переходите к предложениям маркетплейса.</p>
        </div>
        {categories.length === 0 ? (
          <p className={styles.empty}>Категории пока не загружены.</p>
        ) : (
          <div className={styles.grid}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={styles.card}
                onClick={() => navigate(`/catalog?category=${encodeURIComponent(category)}`)}
              >
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

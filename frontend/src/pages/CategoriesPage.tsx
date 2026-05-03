import { useNavigate } from 'react-router-dom';
import { useFilters } from '../features/catalog/useFilters';
import styles from './CategoriesPage.module.css';

const CATEGORY_META: Record<string, { emoji: string; gradient: string }> = {
  'Сувениры':   { emoji: '🎁', gradient: 'linear-gradient(135deg, #f97316, #ef4444)' },
  'Декор':      { emoji: '🏮', gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
  'Фигурки':    { emoji: '🗿', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  'Подарки':    { emoji: '🎀', gradient: 'linear-gradient(135deg, #ec4899, #be185d)' },
  'Прототипы':  { emoji: '⚙️', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  'Миниатюры':  { emoji: '🎮', gradient: 'linear-gradient(135deg, #6366f1, #4338ca)' },
  'Украшения':  { emoji: '💎', gradient: 'linear-gradient(135deg, #0ea5e9, #0369a1)' },
  'Запчасти':   { emoji: '🔧', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
};

const FALLBACK_GRADIENT = 'linear-gradient(135deg, #2f7cff, #1d4ed8)';
const FALLBACK_EMOJI = '📦';

export const CategoriesPage = () => {
  const { categories } = useFilters();
  const navigate = useNavigate();

  const list = categories.length > 0 ? categories : Object.keys(CATEGORY_META);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Категории</h1>
      <div className={styles.grid}>
        {list.map((cat) => {
          const meta = CATEGORY_META[cat];
          return (
            <button
              key={cat}
              className={styles.card}
              style={{ background: meta?.gradient ?? FALLBACK_GRADIENT }}
              onClick={() => navigate(`/catalog?category=${encodeURIComponent(cat)}`)}
            >
              <span className={styles.emoji}>{meta?.emoji ?? FALLBACK_EMOJI}</span>
              <span className={styles.name}>{cat}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

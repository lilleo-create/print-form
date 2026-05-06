import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilters } from '../features/catalog/useFilters';
import styles from './CategoriesPage.module.css';

const CATEGORY_META: Record<string, { emoji: string; gradient: string }> = {
  'Сувениры':        { emoji: '🎁', gradient: 'linear-gradient(145deg, #f97316 0%, #dc2626 100%)' },
  'Декор':           { emoji: '🏮', gradient: 'linear-gradient(145deg, #a855f7 0%, #6d28d9 100%)' },
  'Фигурки':         { emoji: '🗿', gradient: 'linear-gradient(145deg, #3b82f6 0%, #1e40af 100%)' },
  'Подарки':         { emoji: '🎀', gradient: 'linear-gradient(145deg, #ec4899 0%, #9d174d 100%)' },
  'Прототипы':       { emoji: '⚙️', gradient: 'linear-gradient(145deg, #10b981 0%, #065f46 100%)' },
  'Миниатюры':       { emoji: '🎮', gradient: 'linear-gradient(145deg, #6366f1 0%, #3730a3 100%)' },
  'Украшения':       { emoji: '💍', gradient: 'linear-gradient(145deg, #0ea5e9 0%, #075985 100%)' },
  'Запчасти':        { emoji: '🔧', gradient: 'linear-gradient(145deg, #f59e0b 0%, #b45309 100%)' },
  'Аниме':           { emoji: '⛩️', gradient: 'linear-gradient(145deg, #e11d48 0%, #881337 100%)' },
  'Настольные игры': { emoji: '🎲', gradient: 'linear-gradient(145deg, #059669 0%, #064e3b 100%)' },
  'Игрушки':         { emoji: '🧸', gradient: 'linear-gradient(145deg, #fb923c 0%, #c2410c 100%)' },
  'Архитектура':     { emoji: '🏛️', gradient: 'linear-gradient(145deg, #64748b 0%, #1e293b 100%)' },
};

const FALLBACK_GRADIENT = 'linear-gradient(145deg, #2f7cff 0%, #1d4ed8 100%)';
const FALLBACK_EMOJI = '📦';

const SUBCATEGORIES: Record<string, string[]> = {
  'Сувениры':        ['Магниты', 'Брелоки', 'Значки', 'Медальоны', 'Открытки'],
  'Декор':           ['Вазы', 'Рамки', 'Подставки', 'Полки', 'Панно'],
  'Фигурки':         ['Персонажи', 'Животные', 'Фэнтези', 'Sci-Fi'],
  'Подарки':         ['Именные', 'Праздничные', 'Корпоративные'],
  'Прототипы':       ['Механические', 'Архитектурные', 'Технические'],
  'Миниатюры':       ['Игровые', 'Военные', 'Диорамы'],
  'Украшения':       ['Кольца', 'Серьги', 'Броши', 'Браслеты', 'Подвески'],
  'Запчасти':        ['Крепёжные', 'Механические', 'Корпусные'],
  'Аниме':           ['Фигурки', 'Брелоки', 'Значки', 'Статуэтки'],
  'Настольные игры': ['Фишки', 'Жетоны', 'Компоненты', 'Аксессуары'],
  'Игрушки':         ['Конструкторы', 'Головоломки', 'Развивающие'],
  'Архитектура':     ['Макеты зданий', 'Городские элементы', 'Ландшафт'],
};

export const CategoriesPage = () => {
  const { categories } = useFilters();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const list = categories.length > 0 ? categories : Object.keys(CATEGORY_META);

  if (selectedCategory) {
    const subs = SUBCATEGORIES[selectedCategory] ?? [];
    return (
      <div className={styles.page}>
        <div className={styles.subHeader}>
          <button className={styles.backBtn} onClick={() => setSelectedCategory(null)} aria-label="Назад">
            ‹
          </button>
          <h1 className={styles.title}>{selectedCategory}</h1>
        </div>
        <div className={styles.subList}>
          {subs.map((sub) => (
            <button
              key={sub}
              className={styles.subItem}
              onClick={() => navigate(`/catalog?category=${encodeURIComponent(selectedCategory)}`)}
            >
              <span className={styles.subItemName}>{sub}</span>
              <span className={styles.subItemArrow}>›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

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
              onClick={() => setSelectedCategory(cat)}
            >
              <span className={styles.name}>{cat}</span>
              <span className={styles.emoji}>{meta?.emoji ?? FALLBACK_EMOJI}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

import { useNavigate } from 'react-router-dom';
import styles from './QuickCategories.module.css';

const CATS = [
  {
    id: 'mini', name: 'Миниатюры', count: 312,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="5" r="2"/><path d="M9 21V12l-2-3 4-2 4 2-2 3v9"/></svg>,
  },
  {
    id: 'dec', name: 'Декор', count: 188,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M8 3h8v3l-1 2c1 2 2 4 2 6 0 4-3 7-5 7s-5-3-5-7c0-2 1-4 2-6L8 6V3z"/></svg>,
  },
  {
    id: 'auto', name: 'Автозапчасти', count: 96,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 17V12l2-5h14l2 5v5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 12h14"/></svg>,
  },
  {
    id: 'home', name: 'Для быта', count: 224,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11z"/><path d="M9 21v-7h6v7"/></svg>,
  },
  {
    id: 'eng', name: 'Инженерные', count: 178,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>,
  },
  {
    id: 'spare', name: 'Корпуса', count: 108,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>,
  },
];

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

export const QuickCategories = () => {
  const navigate = useNavigate();

  return (
    <section>
      <div className={styles.header}>
        <h2 className={styles.title}>Категории</h2>
        <button className={styles.more} onClick={() => navigate('/catalog')}>
          Все категории <ArrowIcon />
        </button>
      </div>
      <div className={styles.grid}>
        {CATS.map((cat) => (
          <button
            key={cat.id}
            className={styles.tile}
            onClick={() => navigate(`/catalog?category=${encodeURIComponent(cat.name)}`)}
          >
            <span className={styles.icon}>{cat.icon}</span>
            <div>
              <div className={styles.name}>{cat.name}</div>
              <div className={styles.count}>{cat.count} моделей</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

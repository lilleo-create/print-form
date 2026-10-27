import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api';
import { formatModelCount } from '../../shared/lib/modelCount';
import styles from './QuickCategories.module.css';

type CategoryWithCount = {
  id: string;
  slug: string;
  title: string;
  productsCount: number | null;
};

const CATEGORY_ICONS = {
  souvenirs: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 8h18v13H3zM2 8h20V5H2zM12 5v16M7 5C4 3 6 1 9 3l3 2M17 5c3-2 1-4-2-2l-3 2"/></svg>,
  decor: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M8 3h8v3l-1 2c1 2 2 4 2 6 0 4-3 7-5 7s-5-3-5-7c0-2 1-4 2-6L8 6V3z"/></svg>,
  figures: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="5" r="2"/><path d="M9 21V12l-2-3 4-2 4 2-2 3v9"/></svg>,
  gifts: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 8h18v13H3zM2 8h20V5H2zM12 5v16M7 5C4 3 6 1 9 3l3 2M17 5c3-2 1-4-2-2l-3 2"/></svg>,
  prototypes: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8m0-14.2-2.8 2.8m-8.6 8.6-2.8 2.8"/></svg>
};

const FALLBACK_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10"/></svg>;

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

export const QuickCategories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.getReferenceCategoriesWithCounts({ signal: controller.signal })
      .then((response) => { if (active) setCategories(response.data); })
      .catch(async () => {
        if (!active) return;
        try {
          const response = await api.getReferenceCategories();
          if (active) setCategories(response.data.map((category) => ({ ...category, productsCount: null })));
        } catch {
          if (active) setCategories([]);
        }
      });
    return () => { active = false; controller.abort(); };
  }, []);

  return (
    <section>
      <div className={styles.header}>
        <h2 className={styles.title}>Категории</h2>
        <button className={styles.more} onClick={() => navigate('/catalog')}>
          Все категории <ArrowIcon />
        </button>
      </div>
      <div className={styles.grid}>
        {categories.map((category) => (
          <button
            key={category.id}
            className={styles.tile}
            onClick={() => navigate(`/catalog?category=${encodeURIComponent(category.title)}`)}
          >
            <span className={styles.icon}>{CATEGORY_ICONS[category.slug as keyof typeof CATEGORY_ICONS] ?? FALLBACK_ICON}</span>
            <div>
              <div className={styles.name}>{category.title}</div>
              {category.productsCount !== null && (
                <div className={styles.count}>{formatModelCount(category.productsCount)}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFavoritesStore } from '../features/favorites/model/useFavoritesStore';
import { FavoriteCard } from '../features/favorites/ui/FavoriteCard';
import styles from './FavoritesPage.module.css';

export const FavoritesPage = () => {
  const items = useFavoritesStore((state) => state.items);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      if (item.category) seen.add(item.category);
    }
    return Array.from(seen);
  }, [items]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.category === activeFilter);
  }, [items, activeFilter]);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Избранное</h1>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
            <p className={styles.emptyText}>Нет избранных товаров</p>
            <Link to="/catalog" className={styles.emptyBtn}>Перейти в каталог</Link>
          </div>
        ) : (
          <>
            <div className={styles.chips}>
              <button
                type="button"
                className={activeFilter === 'all' ? styles.chipActive : styles.chip}
                onClick={() => setActiveFilter('all')}
              >
                Все
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={activeFilter === cat ? styles.chipActive : styles.chip}
                  onClick={() => setActiveFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className={styles.grid}>
              {filtered.map((item) => (
                <FavoriteCard
                  key={item.id}
                  item={{
                    id: item.id,
                    title: item.title,
                    price: item.price ?? 0,
                    image: item.image,
                    ratingAvg: item.ratingAvg ?? undefined,
                    ratingCount: item.ratingCount ?? undefined,
                    shortSpec: item.shortSpec,
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

import { useEffect } from 'react';
import { Button } from '../shared/ui/Button';
import { useFavoritesStore } from '../features/favorites/model/useFavoritesStore';
import { FavoritesGrid } from '../features/favorites/ui/FavoritesGrid';
import styles from './FavoritesPage.module.css';

export const FavoritesPage = () => {
  const { items, isLoading, error, fetchFavorites } = useFavoritesStore();

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <h1>Избранное</h1>

        {isLoading ? <div className={styles.placeholder}>Загружаем избранные товары…</div> : null}

        {!isLoading && error ? (
          <div className={styles.stateCard}>
            <p>{error}</p>
            <Button variant="secondary" onClick={() => void fetchFavorites()}>
              Повторить
            </Button>
          </div>
        ) : null}

        {!isLoading && !error && items.length === 0 ? (
          <div className={styles.stateCard}>В избранном пока нет товаров.</div>
        ) : null}

        {!isLoading && !error && items.length > 0 ? <FavoritesGrid items={items} /> : null}
      </div>
    </section>
  );
};

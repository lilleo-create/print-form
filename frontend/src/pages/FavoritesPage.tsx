import styles from './FavoritesPage.module.css';

export const FavoritesPage = () => {
  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Избранное</h1>
          <p className={styles.empty}>В избранном пока нет товаров.</p>
        </div>
      </div>
    </section>
  );
};

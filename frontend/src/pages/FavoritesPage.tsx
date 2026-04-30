import styles from './FavoritesPage.module.css';

export const FavoritesPage = () => {
  return (
    <section className={styles.page}>
      <div className={`container ${styles.container}`}>
        <h1>Избранное</h1>
        <div className={styles.stateCard}>
          <p>У вас пока нет избранных товаров.</p>
        </div>
      </div>
    </section>
  );
};

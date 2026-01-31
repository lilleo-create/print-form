import styles from './ReturnsPage.module.css';

export const ReturnsPage = () => {
  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Возвраты</h1>
          <p className={styles.empty}>У вас пока нет возвратов.</p>
        </div>
      </div>
    </section>
  );
};

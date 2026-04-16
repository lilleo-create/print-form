import styles from '../LandingPage.module.css';

export const StepsSection = () => (
  <section className={`${styles.stepsSection} container`} id="how-it-works">
    <h2 className={styles.sectionTitle}>Как это работает</h2>

    <div className={styles.stepsGrid}>
      <div className={styles.stepCard}>
        <span className={styles.stepNumber}>01</span>
        <h3>Выберите модель</h3>
        <p>Найдите готовый товар в каталоге или подготовьте свой заказ.</p>
      </div>

      <div className={styles.stepCard}>
        <span className={styles.stepNumber}>02</span>
        <h3>Подтвердите заказ</h3>
        <p>Согласуйте параметры, стоимость и запуск в производство.</p>
      </div>

      <div className={styles.stepCard}>
        <span className={styles.stepNumber}>03</span>
        <h3>Получите результат</h3>
        <p>Мы напечатаем изделие и отправим его с доставкой.</p>
      </div>
    </div>
  </section>
);
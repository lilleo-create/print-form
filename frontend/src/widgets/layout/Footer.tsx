import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export const Footer = () => (
  <footer className={styles.shell}>
    <div className={styles.container}>
      <div className={styles.cols}>
        <div className={`${styles.col} ${styles.brandCol}`}>
          <div className={styles.brand} aria-label="Print-Form">
            Print<span className={styles.dot} />Form
          </div>
          <p className={styles.blurb}>
            Маркетплейс 3D-печати: покупка, продажа и&nbsp;кастомное изготовление моделей.
          </p>
          <a href="mailto:print.form@mail.ru" className={styles.email}>print.form@mail.ru</a>
        </div>

        <nav className={styles.col} aria-label="Покупателям">
          <h2 className={styles.colHead}>Покупателям</h2>
          <Link to="/catalog">Каталог</Link>
          <Link to="/account?tab=orders">Заказы</Link>
          <Link to="/account?tab=purchases">Купленные товары</Link>
          <Link to="/favorites">Избранные</Link>
          <Link to="/account?tab=returns">Возвраты</Link>
        </nav>

        <nav className={styles.col} aria-label="Продавцам">
          <h2 className={styles.colHead}>Продавцам</h2>
          <Link to="/seller">Кабинет продавца</Link>
          <Link to="/seller/onboarding">Стать продавцом</Link>
        </nav>

        <nav className={styles.col} aria-label="Помощь и документы">
          <h2 className={styles.colHead}>Помощь и документы</h2>
          <Link to="/account?tab=chats">Поддержка</Link>
          <Link to="/account?tab=profile">Профиль</Link>
          <Link to="/privacy-policy">Политика данных</Link>
          <Link to="/service-rules">Правила сервиса</Link>
          <Link to="/offer">Оферта</Link>
        </nav>
      </div>

      <div className={styles.bottom}>
        <span>© 2026 Print-Form · Проект компании Print-Form</span>
        <nav className={styles.legalLinks} aria-label="Юридическая информация">
          <Link to="/privacy-policy">Политика данных</Link>
          <Link to="/service-rules">Правила сервиса</Link>
          <Link to="/offer">Оферта</Link>
        </nav>
      </div>
    </div>
  </footer>
);

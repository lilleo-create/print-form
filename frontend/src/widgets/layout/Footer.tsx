import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export const Footer = () => (
  <footer className={styles.shell}>
    <div className={styles.container}>
      <div className={styles.cols}>
        <div className={styles.col}>
          <div className={styles.brand}>
            Print<span className={styles.dot} />Form
          </div>
          <p className={styles.blurb}>
            Маркетплейс 3D-печати: покупка, продажа и&nbsp;кастомное изготовление моделей.
          </p>
          <a href="mailto:print.form@mail.ru" className={styles.email}>print.form@mail.ru</a>
        </div>

        <div className={styles.col}>
          <h5 className={styles.colHead}>Покупателю</h5>
          <Link to="/catalog">Каталог</Link>
          <Link to="/orders">Заказы</Link>
          <Link to="/favorites">Избранные</Link>
          <Link to="/account?tab=returns">Возвраты</Link>
        </div>

        <div className={styles.col}>
          <h5 className={styles.colHead}>Аккаунт</h5>
          <Link to="/account?tab=profile">Профиль</Link>
          <Link to="/account?tab=chats">Чаты</Link>
          <Link to="/account?tab=settings">Настройки</Link>
          <Link to="/seller">Кабинет продавца</Link>
        </div>

        <div className={styles.col}>
          <h5 className={styles.colHead}>Print-Form</h5>
          <Link to="/catalog">О проекте</Link>
          <Link to="/catalog">Производства</Link>
          <Link to="/catalog">Материалы</Link>
          <Link to="/catalog">Конфигуратор</Link>
        </div>

        <div className={styles.col}>
          <h5 className={styles.colHead}>Документы</h5>
          <Link to="/privacy-policy">Политика данных</Link>
          <Link to="/service-rules">Правила</Link>
          <Link to="/offer">Оферта</Link>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© 2026 Print-Form · Проект компании Print-Form</span>
      </div>
    </div>
  </footer>
);

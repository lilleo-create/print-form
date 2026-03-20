import { Link } from 'react-router-dom';
import styles from './Layout.module.css';

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div>
        <h4>Print-Form</h4>
        <p>
          Маркетплейс 3D-печати: покупка, продажа и кастомное изготовление
          моделей.
        </p>
      </div>

      <div>
        <h5>Контакты</h5>
        <a href="mailto:print.form@mail.ru">print.form@mail.ru</a>
      </div>

      <div>
        <h5>Покупателю</h5>
        <Link to="/orders">Заказы</Link>
        <Link to="/favorites">Избранные</Link>
        <Link to="/account?tab=purchases">Покупки</Link>
        <Link to="/account?tab=returns">Возвраты</Link>
      </div>

      <div>
        <h5>Аккаунт</h5>
        <Link to="/account?tab=profile">Профиль</Link>
        <Link to="/account?tab=settings">Настройки</Link>
        <Link to="/account?tab=chats">Чаты</Link>
        <Link to="/seller">Кабинет продавца</Link>
      </div>

      <div>
        <h5>Сервис</h5>
        <Link to="/">Каталог</Link>
        <Link to="/privacy-policy">О сервисе</Link>
        <Link to="/shop">Ваш магазин</Link>
      </div>

      <div className={styles.footerBottom}>
        <div>© 2026 Print-Form</div>
        <div>Проект компании Print-Form</div>
      </div>
    </footer>
  );
};

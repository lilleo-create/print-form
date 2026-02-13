import styles from './Layout.module.css';

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div>
        <h4>3D Печать маркетплейс</h4>
        <p>Сервис изготовления, покупки и кастомной печати моделей.</p>
      </div>
      <div>
        <h5>Контакты</h5>
        <p>support@3dmarket.ru</p>
        <p>+7 (800) 555-15-15</p>
      </div>
      <div>
        <h5>Сервисы</h5>
        <p>Каталог</p>
        <p>Кастомная печать</p>
        <p>Личный кабинет</p>
      </div>
    </footer>
  );
};

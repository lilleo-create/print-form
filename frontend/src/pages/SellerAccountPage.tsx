import { useState } from 'react';
import styles from './SellerAccountPage.module.css';

const menuItems = [
  'Подключение',
  'Сводка',
  'Товары',
  'Заказы',
  'Логистика',
  'Продвижение',
  'Бухгалтерия',
  'Отчеты',
  'Поддержка',
  'Настройки'
] as const;

export const SellerAccountPage = () => {
  const [activeItem, setActiveItem] = useState<(typeof menuItems)[number]>('Сводка');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2>Кабинет продавца</h2>
            <button type="button" className={styles.closeMenu} onClick={() => setIsMenuOpen(false)}>
              ✕
            </button>
          </div>
          <nav className={styles.menu}>
            {menuItems.map((item) => (
              <button
                key={item}
                type="button"
                className={item === activeItem ? styles.menuItemActive : styles.menuItem}
                onClick={() => {
                  setActiveItem(item);
                  setIsMenuOpen(false);
                }}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div className={styles.content}>
          <div className={styles.topBar}>
            <button type="button" className={styles.menuToggle} onClick={() => setIsMenuOpen(true)}>
              ☰
            </button>
            <div>
              <h1>{activeItem}</h1>
              <p>Раздел продавца PrintForm.</p>
            </div>
          </div>

          <div className={styles.blocks}>
            <div className={styles.block}>
              <h3>Статус раздела</h3>
              <p>Здесь появятся ключевые показатели и быстрые действия для раздела “{activeItem}”.</p>
            </div>
            <div className={styles.block}>
              <h3>Данные и задачи</h3>
              <p>Подготовьте нужные материалы — мы покажем их здесь после подключения модулей.</p>
            </div>
            <div className={styles.block}>
              <h3>Подсказки</h3>
              <p>Рекомендации по работе с каталогом и заказами появятся после запуска.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

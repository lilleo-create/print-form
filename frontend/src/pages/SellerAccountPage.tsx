import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { Product } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { SellerProductModal, SellerProductPayload } from '../widgets/seller/SellerProductModal';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalProducts: 0, averageRating: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      const [productsResponse, statsResponse] = await Promise.all([
        api.getSellerProducts(),
        api.getSellerStats()
      ]);
      setProducts(productsResponse.data);
      setStats(statsResponse.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSaveProduct = async (payload: SellerProductPayload) => {
    if (payload.id) {
      const response = await api.updateSellerProduct(payload.id, payload);
      setProducts((prev) => prev.map((item) => (item.id === payload.id ? response.data : item)));
      return;
    }
    const response = await api.createSellerProduct(payload);
    setProducts((prev) => [response.data, ...prev]);
  };

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

          {activeItem === 'Сводка' && (
            <div className={styles.blocks}>
              <div className={styles.block}>
                <h3>Заказы</h3>
                <p>{stats.totalOrders} всего</p>
              </div>
              <div className={styles.block}>
                <h3>Выручка</h3>
                <p>{stats.totalRevenue.toLocaleString('ru-RU')} ₽</p>
              </div>
              <div className={styles.block}>
                <h3>Товары</h3>
                <p>{stats.totalProducts} в каталоге</p>
              </div>
              <div className={styles.block}>
                <h3>Средний рейтинг</h3>
                <p>{stats.averageRating.toFixed(1)}</p>
              </div>
            </div>
          )}

          {activeItem === 'Товары' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Товары продавца</h2>
                  <p>Создавайте и редактируйте карточки с описанием и фото.</p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setActiveProduct(null);
                    setIsModalOpen(true);
                  }}
                >
                  Добавить товар
                </Button>
              </div>
              {isLoading ? (
                <p className={styles.muted}>Загрузка данных...</p>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <span>Название</span>
                    <span>Цена</span>
                    <span>Категория</span>
                    <span>Действия</span>
                  </div>
                  {products.length === 0 ? (
                    <p className={styles.muted}>Товаров пока нет.</p>
                  ) : (
                    products.map((product) => (
                      <div key={product.id} className={styles.tableRow}>
                        <span>{product.title}</span>
                        <span>{product.price.toLocaleString('ru-RU')} ₽</span>
                        <span>{product.category}</span>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => {
                            setActiveProduct(product);
                            setIsModalOpen(true);
                          }}
                        >
                          Редактировать
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeItem !== 'Сводка' && activeItem !== 'Товары' && (
            <div className={styles.blocks}>
              <div className={styles.block}>
                <h3>Раздел “{activeItem}”</h3>
                <p>Этот модуль подключим в следующих итерациях.</p>
              </div>
            </div>
          )}

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

          {isModalOpen && (
            <SellerProductModal
              product={activeProduct}
              onClose={() => setIsModalOpen(false)}
              onSubmit={handleSaveProduct}
            />
          )}
        </div>
      </div>
    </section>
  );
};

import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { Order, Product } from '../shared/types';
import styles from './SellerAccountPage.module.css';

export const SellerAccountPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.getSellerProducts().then((response) => setProducts(response.data));
    api.getSellerOrders().then((response) => setOrders(response.data));
  }, []);

  const revenue = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Кабинет продавца</h1>
            <p>Управляйте товарами, заказами и статистикой.</p>
          </div>
          <div className={styles.stats}>
            <div>
              <span>Выручка</span>
              <strong>{revenue.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div>
              <span>Заказы</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>Товары</span>
              <strong>{products.length}</strong>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Товары</h2>
          <div className={styles.productGrid}>
            {products.slice(0, 6).map((product) => (
              <div key={product.id} className={styles.productCard}>
                <img src={product.image} alt={product.title} />
                <div>
                  <h4>{product.title}</h4>
                  <p>{product.price.toLocaleString('ru-RU')} ₽</p>
                </div>
                <div className={styles.actions}>
                  <button>Редактировать</button>
                  <button>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2>Заказы</h2>
          <div className={styles.orderList}>
            {orders.map((order) => (
              <div key={order.id} className={styles.orderCard}>
                <div>
                  <h4>Заказ #{order.id}</h4>
                  <span>{order.createdAt}</span>
                </div>
                <div>
                  <strong>{order.total.toLocaleString('ru-RU')} ₽</strong>
                  <p>Позиции: {order.items.length}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

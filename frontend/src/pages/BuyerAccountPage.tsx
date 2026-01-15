import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { Order } from '../shared/types';
import styles from './BuyerAccountPage.module.css';

const statusMap: Record<Order['status'], string> = {
  processing: 'В обработке',
  printing: 'В печати',
  shipped: 'Отправлен',
  delivered: 'Доставлен'
};

export const BuyerAccountPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.getOrders().then((response) => setOrders(response.data));
  }, []);

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Личный кабинет</h1>
            <p>Профиль покупателя и история заказов.</p>
          </div>
          <div className={styles.profileCard}>
            <h4>Алина Смирнова</h4>
            <p>buyer@3dmarket.ru</p>
            <span>Статус: Premium</span>
          </div>
        </div>

        <h2>История заказов</h2>
        <div className={styles.orders}>
          {orders.map((order) => (
            <article key={order.id} className={styles.orderCard}>
              <div>
                <h4>Заказ #{order.id}</h4>
                <p>{order.createdAt}</p>
              </div>
              <div>
                <strong>{statusMap[order.status]}</strong>
                <p>{order.total.toLocaleString('ru-RU')} ₽</p>
              </div>
              <div className={styles.items}>
                {order.items.map((item) => (
                  <span key={item.product.id}>{item.product.title}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

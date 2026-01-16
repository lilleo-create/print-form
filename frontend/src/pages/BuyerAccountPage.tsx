import { useEffect } from 'react';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { OrderStatus } from '../shared/types';
import styles from './BuyerAccountPage.module.css';

const statusMap: Record<OrderStatus, string> = {
  processing: 'В обработке',
  printing: 'В печати',
  shipped: 'Отправлен',
  delivered: 'Доставлен'
};

export const BuyerAccountPage = () => {
  const loadOrders = useOrdersStore((state) => state.loadOrders);
  const orders = useOrdersStore((state) => state.orders);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      loadOrders(user);
    }
  }, [loadOrders, user]);

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Личный кабинет</h1>
            <p>Профиль покупателя и история заказов.</p>
          </div>
          <div className={styles.profileCard}>
            <h4>{user?.name}</h4>
            <p>{user?.email}</p>
            <span>Статус: Premium</span>
          </div>
        </div>

        <h2>История заказов</h2>
        <div className={styles.orders}>
          {orders.length === 0 ? (
            <p className={styles.empty}>Пока нет заказов.</p>
          ) : (
            orders.map((order) => (
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
                    <span key={item.productId}>
                      {item.name} × {item.qty}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

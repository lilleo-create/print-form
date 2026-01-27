import { useEffect } from 'react';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import styles from './OrdersPage.module.css';

export const OrdersPage = () => {
  const user = useAuthStore((state) => state.user);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  return (
    <section className={styles.page}>
      <div className="container">
        <header className={styles.header}>
          <h1>Заказы</h1>
          <p>История ваших покупок.</p>
        </header>
        {orders.length === 0 ? (
          <p className={styles.empty}>У вас пока нет заказов.</p>
        ) : (
          <div className={styles.list}>
            {orders.map((order) => (
              <article key={order.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Заказ №{order.id}</h3>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className={styles.total}>{order.total.toLocaleString('ru-RU')} ₽</div>
                </div>
                <ul className={styles.items}>
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`} className={styles.item}>
                      <div className={styles.itemInfo}>
                        <strong>{item.title}</strong>
                        <span>{item.qty} шт.</span>
                      </div>
                      <span>{item.lineTotal.toLocaleString('ru-RU')} ₽</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

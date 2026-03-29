import { useEffect } from 'react';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { OrdersList } from '../components/orders/OrdersList';
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
        <OrdersList orders={orders} />
      </div>
    </section>
  );
};

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import type { PaymentIntent } from '../shared/types';
import { OrdersList } from '../components/orders/OrdersList';
import { PaymentBanner } from '../components/orders/PaymentBanner';
import styles from './OrdersPage.module.css';

export const OrdersPage = () => {
  const user = useAuthStore((state) => state.user);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const location = useLocation();
  const paymentIntent = (location.state as { paymentIntent?: PaymentIntent | null } | null)?.paymentIntent ?? null;

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

        {paymentIntent ? <PaymentBanner paymentIntent={paymentIntent} /> : null}
        <OrdersList orders={orders} />
      </div>
    </section>
  );
};

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { PaymentIntent } from '../shared/types';
import styles from './OrdersPage.module.css';

const deliveryLabel = (order: { delivery?: { deliveryMethod: 'COURIER' | 'PICKUP_POINT'; courierAddress?: { line1?: string; city?: string } | null; pickupPoint?: { id: string; fullAddress: string } | null } | null }) => {
  if (!order.delivery) return null;
  if (order.delivery.deliveryMethod === 'COURIER') {
    const line = [order.delivery.courierAddress?.line1, order.delivery.courierAddress?.city].filter(Boolean).join(', ');
    return `Курьер: ${line || 'адрес уточняется'}`;
  }

  if (order.delivery.pickupPoint) {
    return `ПВЗ: ${order.delivery.pickupPoint.fullAddress} (ID: ${order.delivery.pickupPoint.id})`;
  }

  return 'ПВЗ: не выбран';
};

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
        {paymentIntent && (
          <div className={styles.paymentBanner}>
            <strong>Оплата заказа</strong>
            <span>
              Секрет платежа: {paymentIntent.clientSecret ?? paymentIntent.id}
            </span>
          </div>
        )}
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
                {deliveryLabel(order) ? <p>{deliveryLabel(order)}</p> : null}
                {order.shipment ? (
                  <p>
                    Статус доставки: {order.shipment.status}
                    {order.shipment.requestId ? ` · трек: ${order.shipment.requestId}` : ''}
                  </p>
                ) : null}
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

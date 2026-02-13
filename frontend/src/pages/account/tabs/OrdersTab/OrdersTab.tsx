import { Order } from '../../../../shared/types';
import styles from './OrdersTab.module.css';

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

interface OrdersTabProps {
  orders: Order[];
}

export const OrdersTab = ({ orders }: OrdersTabProps) => {
  return (
    <div className={styles.section}>
      {orders.length === 0 ? (
        <p className={styles.empty}>Активных заказов нет.</p>
      ) : (
        <div className={styles.ordersList}>
          {orders.map((order) => (
            <article key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
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
  );
};

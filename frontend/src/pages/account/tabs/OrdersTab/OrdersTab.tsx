import { Order } from '../../../../shared/types';
import styles from './OrdersTab.module.css';

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

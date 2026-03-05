import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getDeliveryStatusLabel } from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import { OrderItemsList } from './OrderItemsList';
import styles from './OrdersComponents.module.css';

interface OrderCardProps {
  order: Order;
}

export const OrderCard = ({ order }: OrderCardProps) => {
  const navigate = useNavigate();
  const deliveryLabel = getOrderDeliveryLabel(order);

  return (
    <article className={styles.card}>
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

      <OrderItemsList order={order} />

      {deliveryLabel ? <p>{deliveryLabel}</p> : null}
      <p>Статус доставки: {getDeliveryStatusLabel(order)}</p>
      <p>Трек-номер: {order.trackingNumber ?? '—'}</p>
      <button type="button" className={styles.returnLink} onClick={() => navigate(`/returns?orderId=${order.id}`)}>
        Оформить возврат
      </button>
    </article>
  );
};

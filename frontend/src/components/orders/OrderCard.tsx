import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getDeliveryStatusLabel } from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import { OrderItemsMini } from './OrderItemsMini';
import styles from './OrdersComponents.module.css';

interface OrderCardProps {
  order: Order;
}

export const OrderCard = ({ order }: OrderCardProps) => {
  const navigate = useNavigate();
  const deliveryLabel = getOrderDeliveryLabel(order);
  const firstItem = order.items[0];

  const openProduct = () => {
    if (!firstItem?.productId) return;
    navigate(`/product/${firstItem.productId}`);
  };

  const handleCreateReturn = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/returns?orderId=${order.id}`);
  };

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={openProduct}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProduct();
        }
      }}
    >
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

      <OrderItemsMini order={order} />

      {deliveryLabel ? <p>{deliveryLabel}</p> : null}
      <p>Статус доставки: {getDeliveryStatusLabel(order)}</p>
      {order.trackingNumber ? <p>СДЭК: {order.trackingNumber}</p> : null}
      <button type="button" className={styles.returnLink} onClick={handleCreateReturn}>
        Оформить возврат
      </button>
    </article>
  );
};

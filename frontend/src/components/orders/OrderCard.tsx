import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getDeliveryStatusLabel } from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import { OrderItemsMini } from './OrderItemsMini';
import styles from './OrdersComponents.module.css';
import { formatPrice } from '../../utils/money';

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
    navigate(`/account?tab=returns&orderId=${order.id}`);
  };

  const paymentStatusLabel = (() => {
    switch (order.paymentStatus) {
      case 'PAID':
        return 'Оплачено';
      case 'REFUND_PENDING':
        return 'Возврат обрабатывается';
      case 'REFUNDED':
        return 'Деньги возвращены';
      case 'PAYMENT_EXPIRED':
        return 'Оплата не прошла';
      case 'PENDING':
      default:
        return 'Ожидает оплаты';
    }
  })();

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
        <div className={styles.total}>{formatPrice(order.total)} ₽</div>
      </div>

      <OrderItemsMini order={order} />

      {deliveryLabel ? <p>{deliveryLabel}</p> : null}
      <p>Статус доставки: {getDeliveryStatusLabel(order)}</p>
      <p>Статус оплаты: {paymentStatusLabel}</p>
      {order.paidAt ? (
        <p>
          Оплачен: {new Date(order.paidAt).toLocaleString('ru-RU')}
        </p>
      ) : null}
      {order.trackingNumber ? <p>СДЭК: {order.trackingNumber}</p> : null}
      {order.status !== 'CANCELLED' ? (
        <button type="button" className={styles.returnLink} onClick={handleCreateReturn}>
          Оформить возврат
        </button>
      ) : null}
    </article>
  );
};

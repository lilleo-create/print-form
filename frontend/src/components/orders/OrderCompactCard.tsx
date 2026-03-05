import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getDeliveryStatusLabel, isCancellableDeliveryStage, isDeliveredDeliveryStage } from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import { formatEtaDateRange } from '../../shared/lib/deliveryEta';
import { ProductMiniCard } from './ProductMiniCard';
import styles from './OrdersComponents.module.css';

export const OrderCompactCard = ({ order }: { order: Order }) => {
  const navigate = useNavigate();
  const firstItem = order.items[0];
  const moreCount = Math.max(0, order.items.length - 1);
  const deliveryLabel = getOrderDeliveryLabel(order);

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isDeliveredDeliveryStage(order)) {
      navigate(`/returns?orderId=${order.id}`);
      return;
    }
    if (isCancellableDeliveryStage(order)) {
      navigate(`/cancel?orderId=${order.id}`);
    }
  };

  return (
    <article className={styles.card} role="button" tabIndex={0} onClick={() => firstItem?.productId && navigate(`/product/${firstItem.productId}`)}>
      <div className={styles.cardHeader}>
        <h3>Заказ №{order.id}</h3>
        <span>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
      </div>
      {firstItem ? <ProductMiniCard title={firstItem.title} price={firstItem.price} qty={firstItem.qty} image={firstItem.image} /> : null}
      {moreCount > 0 ? <span className={styles.muted}>+ {moreCount} товаров</span> : null}
      <p>Статус доставки: {getDeliveryStatusLabel(order)}</p>
      {deliveryLabel ? <p>{deliveryLabel}</p> : null}
      {order.trackingNumber ? (
        <a href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(order.trackingNumber)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          СДЭК: {order.trackingNumber}
        </a>
      ) : null}
      {order.deliveryDaysMin && order.deliveryDaysMax ? (
        <>
          <p>Срок доставки: СДЭК {order.deliveryDaysMin}–{order.deliveryDaysMax} дней</p>
          <p>Ориентировочно: {order.estimatedDeliveryDateMin && order.estimatedDeliveryDateMax
            ? formatEtaDateRange(order.estimatedDeliveryDateMin, 0, Math.max(0, Math.round((new Date(order.estimatedDeliveryDateMax).getTime()-new Date(order.estimatedDeliveryDateMin).getTime())/86400000)))
            : formatEtaDateRange(order.createdAt, order.deliveryDaysMin, order.deliveryDaysMax)}</p>
        </>
      ) : null}
      {(isDeliveredDeliveryStage(order) || isCancellableDeliveryStage(order)) ? (
        <button type="button" className={styles.returnLink} onClick={handleAction}>
          {isDeliveredDeliveryStage(order) ? 'Оформить возврат' : 'Отменить заказ'}
        </button>
      ) : null}
    </article>
  );
};

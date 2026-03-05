import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getDeliveryStatusLabel, hasHandoverStarted, isCancellableDeliveryStage } from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import { formatEtaDateRange, formatEtaDateRangeFromDates, formatEtaDays } from '../../shared/lib/deliveryEta';
import { ProductMiniCard } from './ProductMiniCard';
import styles from './OrdersComponents.module.css';

export const OrderCompactCard = ({ order }: { order: Order }) => {
  const navigate = useNavigate();
  const firstItem = order.items[0];
  const moreCount = Math.max(0, order.items.length - 1);
  const deliveryLabel = getOrderDeliveryLabel(order);

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isCancellableDeliveryStage(order)) {
      navigate(`/cancel?orderId=${order.id}`);
      return;
    }
    navigate(`/account?tab=returns&orderId=${order.id}`);
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
      {formatEtaDays(order.deliveryDaysMin, order.deliveryDaysMax) ? (
        <>
          <p>{formatEtaDays(order.deliveryDaysMin, order.deliveryDaysMax)}</p>
          <p>{formatEtaDateRangeFromDates(order.estimatedDeliveryDateMin, order.estimatedDeliveryDateMax) ?? formatEtaDateRange(order.createdAt, order.deliveryDaysMin, order.deliveryDaysMax)}</p>
        </>
      ) : null}
      {(hasHandoverStarted(order) || isCancellableDeliveryStage(order)) ? (
        <button type="button" className={styles.returnLink} onClick={handleAction}>
          {isCancellableDeliveryStage(order) ? 'Отменить заказ' : 'Оформить возврат'}
        </button>
      ) : null}
    </article>
  );
};

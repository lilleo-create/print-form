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
  const isCancelled = order.status === 'CANCELLED';
  const isRefundPending = order.paymentStatus === 'REFUND_PENDING';
  const isRefunded = order.paymentStatus === 'REFUNDED';
  const refundStatusLabel = isRefundPending
    ? 'Возврат обрабатывается'
    : isRefunded
      ? 'Деньги возвращены'
      : null;
  const canCancel = !isCancelled && isCancellableDeliveryStage(order);
  const canCreateReturn = !isCancelled && hasHandoverStarted(order);

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (canCancel) {
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
      {formatEtaDays(order.deliveryDaysMin ?? null, order.deliveryDaysMax ?? null) ? (
        <>
          <p>{formatEtaDays(order.deliveryDaysMin ?? null, order.deliveryDaysMax ?? null)}</p>
          <p>{formatEtaDateRangeFromDates(order.estimatedDeliveryDateMin ?? null, order.estimatedDeliveryDateMax ?? null) ?? formatEtaDateRange(order.createdAt, order.deliveryDaysMin ?? null, order.deliveryDaysMax ?? null)}</p>
        </>
      ) : null}
      {refundStatusLabel ? <p className={styles.muted}>{refundStatusLabel}</p> : null}
      {(canCreateReturn || canCancel) ? (
        <button type="button" className={styles.returnLink} onClick={handleAction}>
          {canCancel ? 'Отменить заказ' : 'Оформить возврат'}
        </button>
      ) : null}
    </article>
  );
};

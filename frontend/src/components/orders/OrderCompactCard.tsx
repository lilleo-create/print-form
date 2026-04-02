import type { MouseEvent } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import {
  getDeliveryStatusLabel,
  hasHandoverStarted,
  isCancellableDeliveryStage
} from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import {
  formatEtaDateRange,
  formatEtaDateRangeFromDates,
  formatEtaDays
} from '../../shared/lib/deliveryEta';
import { ProductMiniCard } from './ProductMiniCard';
import styles from './OrdersComponents.module.css';
import { formatPrice } from '../../utils/money';

interface OrderCompactCardProps {
  order: Order;
  highlighted?: boolean;
  hasActiveReturn?: boolean;
  onCancelOrder?: (order: Order) => void;
  onRetryPayment?: (orderId: string) => void;
}

const getPaymentStatusLabel = (paymentStatus?: string | null) => {
  switch (paymentStatus) {
    case 'PAID':
      return 'Оплачено';
    case 'REFUND_PENDING':
      return 'Возврат обрабатывается';
    case 'REFUNDED':
      return 'Деньги возвращены';
    case 'PARTIALLY_REFUNDED':
      return 'Частичный возврат';
    case 'PAYMENT_EXPIRED':
      return 'Оплата не прошла';
    case 'PENDING':
    default:
      return 'Ожидает оплаты';
  }
};

const getOrderStatusLabel = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return 'Получен покупателем';
    case 'CANCELLED':
      return 'Отменён';
    case 'RETURNED':
      return 'Возврат';
    case 'EXPIRED':
      return 'Просрочен';
    default:
      return 'В работе';
  }
};

export const OrderCompactCard = ({
  order,
  highlighted = false,
  hasActiveReturn = false,
  onCancelOrder,
  onRetryPayment
}: OrderCompactCardProps) => {
  const navigate = useNavigate();
  const firstItem = order.items[0];
  const moreCount = Math.max(0, order.items.length - 1);
  const deliveryLabel = getOrderDeliveryLabel(order);
  const isCancelled = order.status === 'CANCELLED';
  const isRefundPending = order.paymentStatus === 'REFUND_PENDING';
  const isRefunded = order.paymentStatus === 'REFUNDED';
  const isPaid = order.paymentStatus === 'PAID';
  const isShipped = hasHandoverStarted(order);
  const isSafeDealMode = Boolean(order.yookassaDealId);
  const isHeldBySafeDeal =
    isSafeDealMode &&
    ['HOLD', 'PENDING'].includes(
      String(order.yookassaDealStatus ?? order.payoutStatus ?? '').toUpperCase()
    );

  const orderStatusLabel = getOrderStatusLabel(String(order.status ?? '').toUpperCase());
  const deliveryStatusLabel = isCancelled ? '—' : getDeliveryStatusLabel(order);
  const payoutStatusLabel = isHeldBySafeDeal
    ? 'Заморожено'
    : isPaid
      ? 'Доступно к выплате'
      : 'Ожидает оплаты';
  const status = isCancelled ? 'Заказ отменён' : `Заказ: ${orderStatusLabel}`;
  const subStatus = useMemo(() => {
    if (isCancelled) {
      if (isRefundPending) {
        return 'Деньги вернутся на карту в течение 1–5 дней';
      }
      if (isRefunded) {
        return 'Деньги возвращены';
      }
      return 'Возврат оформлен';
    }

    if (isHeldBySafeDeal) {
      return 'Средства станут доступны после получения заказа';
    }

    if (orderStatusLabel === 'Получен покупателем') {
      return 'Завершён автоматически после вручения';
    }

    return `Статус оплаты: ${getPaymentStatusLabel(order.paymentStatus)}`;
  }, [isCancelled, isHeldBySafeDeal, isRefundPending, isRefunded, order.paymentStatus, orderStatusLabel]);

  const canCancel = !isCancelled && !hasActiveReturn && !isRefunded && isPaid && isCancellableDeliveryStage(order);
  const canCreateReturn = !isCancelled && !hasActiveReturn && !isRefunded && isPaid && isShipped;

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (canCancel) {
      if (onCancelOrder) {
        onCancelOrder(order);
        return;
      }
      navigate(`/cancel?orderId=${order.id}`);
      return;
    }

    if (canCreateReturn) {
      navigate(`/returns?orderId=${order.id}`);
    }
  };

  const handleRetry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!onRetryPayment) return;
    onRetryPayment(order.id);
  };

  return (
    <article
      className={`${styles.card} ${highlighted ? styles.cardHighlighted : ''}`.trim()}
      role="button"
      tabIndex={0}
      onClick={() => firstItem?.productId && navigate(`/product/${firstItem.productId}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (firstItem?.productId) {
            navigate(`/product/${firstItem.productId}`);
          }
        }
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.headerMeta}>
          <h3>Заказ №{order.id}</h3>
          <span>{new Date(order.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className={styles.total}>{formatPrice(order.total)}</div>
      </div>

      {firstItem ? <ProductMiniCard title={firstItem.title} price={firstItem.price} qty={firstItem.qty} image={firstItem.image} /> : null}
      {moreCount > 0 ? <span className={styles.caption}>+ ещё {moreCount} товаров</span> : null}

      <div className={styles.statusSection}>
        <span className={`${styles.badge} ${isCancelled ? styles.badgeDanger : styles.badgeNeutral}`}>{status}</span>
        {!isCancelled ? (
          <>
            <p className={styles.caption}>Доставка: {deliveryStatusLabel}</p>
            <p className={styles.caption}>Выплата продавцу: {payoutStatusLabel}</p>
          </>
        ) : null}
        <p className={styles.substatus}>{subStatus}</p>

        {!isCancelled ? (
          <>
            {deliveryLabel ? <p className={styles.caption}>{deliveryLabel}</p> : null}
            {order.trackingNumber ? (
              <a
                href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(order.trackingNumber)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className={styles.link}
              >
                СДЭК: {order.trackingNumber}
              </a>
            ) : null}
            {formatEtaDays(order.deliveryDaysMin ?? null, order.deliveryDaysMax ?? null) ? (
              <>
                <p className={styles.caption}>{formatEtaDays(order.deliveryDaysMin ?? null, order.deliveryDaysMax ?? null)}</p>
                <p className={styles.caption}>
                  {formatEtaDateRangeFromDates(order.estimatedDeliveryDateMin ?? null, order.estimatedDeliveryDateMax ?? null) ??
                    formatEtaDateRange(order.createdAt, order.deliveryDaysMin ?? null, order.deliveryDaysMax ?? null)}
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <div className={styles.actionsRow}>
        {order.isExpired && order.canRetryPayment && onRetryPayment ? (
          <button type="button" className={styles.actionButtonSecondary} onClick={handleRetry}>
            Повторить оплату
          </button>
        ) : null}

        {!isCancelled && !isRefunded && hasActiveReturn ? (
          <button type="button" className={styles.actionButtonSecondary} disabled>
            Возврат оформлен
          </button>
        ) : null}

        {(canCreateReturn || canCancel) ? (
          <button type="button" className={styles.actionButton} onClick={handleAction}>
            {canCancel ? 'Отменить заказ' : 'Оформить возврат'}
          </button>
        ) : null}
      </div>
    </article>
  );
};

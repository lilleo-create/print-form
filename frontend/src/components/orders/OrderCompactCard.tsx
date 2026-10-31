import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { hasHandoverStarted, isCancellableDeliveryStage } from '../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../shared/lib/deliveryLabel';
import { getHumanOrderStatus } from '../../shared/lib/orderPresentation';
import { ProductMiniCard } from './ProductMiniCard';
import { CopyableOrderNumber } from '../seller/CopyableOrderNumber';
import styles from './OrdersComponents.module.css';
import { formatPrice } from '../../utils/money';

interface OrderCompactCardProps {
  order: Order;
  highlighted?: boolean;
  hasActiveReturn?: boolean;
  onCancelOrder?: (order: Order) => void;
  onRetryPayment?: (orderId: string) => void;
}

export const OrderCompactCard = ({ order, highlighted = false, hasActiveReturn = false, onCancelOrder, onRetryPayment }: OrderCompactCardProps) => {
  const navigate = useNavigate();
  const item = order.items[0];
  const cancelled = order.status === 'CANCELLED';
  const refunded = order.paymentStatus === 'REFUNDED';
  const paid = order.paymentStatus === 'PAID';
  const canCancel = !cancelled && !hasActiveReturn && !refunded && paid && isCancellableDeliveryStage(order);
  const canReturn = !cancelled && !hasActiveReturn && !refunded && paid && hasHandoverStarted(order);
  const open = () => navigate(`/account/orders/${order.id}`);
  const stop = (event: MouseEvent<HTMLButtonElement>, callback: () => void) => { event.stopPropagation(); callback(); };
  return <article className={`${styles.card} ${styles.buyerOrderCard} ${highlighted ? styles.cardHighlighted : ''}`} role="link" tabIndex={0} onClick={open} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}>
    <div className={styles.buyerOrderHeader}>
      <div className={styles.buyerOrderNumber}>
        <h3 onClick={event => event.stopPropagation()}><CopyableOrderNumber orderId={order.id} publicNumber={order.publicNumber} /></h3>
        <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
      </div>
      <strong className={styles.buyerOrderTotal}>{formatPrice(order.financials?.total ?? order.total)}</strong>
    </div>
    <div className={styles.buyerOrderBody}>
      <div className={styles.buyerOrderProduct}>
        {item && <ProductMiniCard title={item.title} price={item.price} qty={item.qty} image={item.image} />}
        {order.items.length > 1 && <span className={styles.caption}>+ ещё {order.items.length - 1} товаров</span>}
      </div>
      <span className={`${styles.buyerOrderBadge} ${cancelled ? styles.badgeDanger : styles.badgeNeutral}`}>{getHumanOrderStatus(order)}</span>
    </div>
    <div className={styles.buyerOrderFooter}>
      <div className={styles.buyerOrderDelivery}>
        <span>{getOrderDeliveryLabel(order) || 'Доставка бесплатно'}</span>
        {order.trackingNumber && <span className={styles.buyerOrderTrack}>CDEK · {order.trackingNumber}</span>}
      </div>
      {(canCancel || canReturn || (order.isExpired && order.canRetryPayment)) && <div className={styles.buyerOrderActions}>
        {order.isExpired && order.canRetryPayment && onRetryPayment && <button type="button" className={styles.actionButtonSecondary} onClick={event => stop(event, () => onRetryPayment(order.id))}>Повторить оплату</button>}
        {canCancel && <button type="button" className={styles.actionButtonSecondary} onClick={event => stop(event, () => onCancelOrder?.(order))}>Отменить заказ</button>}
        {canReturn && <button type="button" className={styles.actionButtonSecondary} onClick={event => stop(event, () => navigate(`/account?tab=returns&orderId=${order.id}`))}>Оформить возврат</button>}
      </div>}
    </div>
  </article>;
};

import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getHumanOrderStatus } from '../../shared/lib/orderPresentation';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import styles from './OrdersComponents.module.css';

interface OrderCompactCardProps {
  order: Order;
  highlighted?: boolean;
}

export const OrderCompactCard = ({ order, highlighted = false }: OrderCompactCardProps) => {
  const navigate = useNavigate();
  const status = getHumanOrderStatus(order);
  const deliveredDate = order.status === 'DELIVERED' && order.deliveredToRecipientAt
    ? new Date(order.deliveredToRecipientAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : null;
  const images = order.items.slice(0, 3);
  const open = () => navigate(`/account/orders/${order.id}`);

  return <article className={`${styles.marketOrderCard} ${highlighted ? styles.cardHighlighted : ''}`} role="link" tabIndex={0} aria-label={`Открыть заказ ${order.publicNumber || order.id}`} onClick={open} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } }}>
    <div className={styles.marketStatusRow}>
      <span className={styles.marketStatusIcon} aria-hidden="true">{order.status === 'DELIVERED' ? '✓' : '●'}</span>
      <div className={styles.marketStatusCopy}>
        <strong>{status}{deliveredDate ? ` ${deliveredDate}` : ''}</strong>
        <span>{order.buyerPickupPvzMeta?.addressFull ? `ПВЗ · ${order.buyerPickupPvzMeta.addressFull}` : 'Доставка CDEK'}</span>
      </div>
      <span className={styles.marketChevron} aria-hidden="true">›</span>
    </div>
    <div className={styles.marketProductRow}>
      <div className={styles.marketImages}>{images.map((item, index) => {
        const src = resolveImageUrl(item.image);
        return src ? <img key={item.id || `${item.productId}-${index}`} src={src} alt="" /> : <span key={item.id || `${item.productId}-${index}`} aria-hidden="true">▧</span>;
      })}</div>
      <div className={styles.marketProductCopy}><strong>{order.items.length === 1 ? order.items[0].title : `${order.items.length} товара`}</strong><span>{order.items.length === 1 ? `${order.items[0].qty} шт.` : order.items.slice(0, 2).map(item => item.title).join(' · ')}</span></div>
      <span className={styles.marketOrderNumber}>{order.publicNumber || order.id}</span>
    </div>
  </article>;
};

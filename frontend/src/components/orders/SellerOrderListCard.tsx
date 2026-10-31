import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { getHumanOrderStatus, getSellerNextAction } from '../../shared/lib/orderPresentation';
import { formatPriceWithKopecks } from '../../shared/lib/formatPrice';
import styles from './SellerOrderListCard.module.css';

type Props = { order: Order; onStart: (id: string) => void; onPack: (order: Order) => void; onShipment: (id: string) => void };
export const SellerOrderListCard = ({ order, onStart, onPack, onShipment }: Props) => {
  const navigate = useNavigate();
  const item = order.items[0];
  const next = getSellerNextAction(order);
  const open = () => navigate(`/seller/orders/${order.id}`);
  const action = next === 'production' ? { label: 'Начать производство', run: () => onStart(order.id) } :
    next === 'pack' ? { label: 'Товар упакован', run: () => onPack(order) } :
    next === 'shipment' ? { label: 'Создать доставку в CDEK', run: () => onShipment(order.id) } : null;
  return <article className={styles.card} role="link" tabIndex={0} onClick={open} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}>
    <div className={styles.image}>{item?.image && <img src={item.image} alt="" />}</div>
    <div className={styles.content}><div className={styles.heading}><strong>{order.publicNumber || order.id}</strong><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</time></div>
      <p>{order.recipientName || order.buyer?.name || 'Покупатель'}</p><p className={styles.product}>{item?.title || 'Заказ'} · {item?.qty ?? 1} шт.{order.items.length > 1 ? ` + ещё ${order.items.length - 1}` : ''}</p>
      <span className={styles.status}>{getHumanOrderStatus(order)}</span></div>
    <div className={styles.end}><strong>{formatPriceWithKopecks(order.financials?.total ?? order.total)}</strong>{action && <button type="button" onClick={event => { event.stopPropagation(); action.run(); }}>{action.label}</button>}</div>
  </article>;
};

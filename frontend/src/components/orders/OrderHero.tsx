import type { Order } from '../../shared/types';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { formatPriceWithKopecks } from '../../shared/lib/formatPrice';
import { getHumanOrderStatus } from '../../shared/lib/orderPresentation';
import styles from './OrderHero.module.css';

type Props = { order: Order; audience: 'buyer' | 'seller' };

export const OrderHero = ({ order, audience }: Props) => {
  const item = order.items[0];
  const image = resolveImageUrl(item?.image);
  const moreItems = Math.max(0, order.items.length - 1);

  return <header className={styles.hero}>
    <div className={styles.product}>
      <div className={styles.imageWrap}>
        {image ? <img src={image} alt="" /> : <span aria-hidden="true">▧</span>}
      </div>
      <div className={styles.productCopy}>
        <span className={styles.eyebrow}>{audience === 'seller' ? 'Заказ продавца' : 'Ваш заказ'}</span>
        <h1>{item?.title || 'Заказ'}</h1>
        <p>{item ? `${item.qty} шт.${moreItems ? ` · ещё ${moreItems} в заказе` : ''}` : 'Товары в заказе'}</p>
      </div>
    </div>
    <div className={styles.facts}>
      <div className={styles.fact}><span>Номер заказа</span><strong className={styles.orderNumber}>{order.publicNumber || order.id}</strong></div>
      <div className={styles.fact}><span>Дата заказа</span><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
      <div className={styles.fact}><span>Сумма заказа</span><strong className={styles.amount}>{formatPriceWithKopecks(order.financials?.total ?? order.total)}</strong></div>
      <div className={styles.fact}><span>Текущий статус</span><strong className={styles.status}>{getHumanOrderStatus(order)}</strong></div>
    </div>
  </header>;
};

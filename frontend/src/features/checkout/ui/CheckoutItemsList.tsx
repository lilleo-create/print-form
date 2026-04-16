import type { CheckoutDto } from '../api/checkoutApi';
import styles from './CheckoutItemsList.module.css';
import { SmartImage } from '../../../shared/ui/SmartImage';
import { formatPrice } from '../../../utils/money';

type Props = { items: CheckoutDto['cartItems'] };

export const CheckoutItemsList = ({ items }: Props) => (
  <div className={styles.list}>
    <h3>Состав заказа</h3>
    {items.map((item) => (
      <article key={item.productId} className={styles.item}>
        <SmartImage src={item.image ?? ''} alt={item.title} sizePreset="card" />
        <div className={styles.meta}>
          <h4>{item.title}</h4>
          <p>{item.shortSpec ?? 'SKU/variant'}</p>
          <p>{item.quantity} × {formatPrice(item.price)}</p>
        </div>
        <strong className={styles.total}>{formatPrice(item.quantity * item.price)}</strong>
      </article>
    ))}
  </div>
);

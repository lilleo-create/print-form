import type { CheckoutDto } from '../api/checkoutApi';
import styles from './CheckoutItemsList.module.css';
import { SmartImage } from '../../../shared/ui/SmartImage';
import { formatPrice } from '../../../utils/money';

type Props = { items: CheckoutDto['cartItems'] };

export const CheckoutItemsList = ({ items }: Props) => (
  <div className={styles.list}>
    {items.map((item) => (
      <article key={item.productId} className={styles.item}>
        <SmartImage src={item.image ?? ''} alt={item.title} sizePreset="card" />
        <div>
          <h4>{item.title}</h4>
          <p>{item.shortSpec ?? 'SKU/variant'}</p>
          <p>{item.quantity} × {formatPrice(item.price)} ₽</p>
        </div>
      </article>
    ))}
  </div>
);

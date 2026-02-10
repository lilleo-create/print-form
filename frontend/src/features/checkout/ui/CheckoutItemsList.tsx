import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import type { CheckoutDto } from '../api/checkoutApi';
import styles from './CheckoutItemsList.module.css';

type Props = { items: CheckoutDto['cartItems'] };

export const CheckoutItemsList = ({ items }: Props) => (
  <div className={styles.list}>
    {items.map((item) => (
      <article key={item.productId} className={styles.item}>
        <img src={resolveImageUrl(item.image ?? '')} alt={item.title} />
        <div>
          <h4>{item.title}</h4>
          <p>{item.shortSpec ?? 'SKU/variant'}</p>
          <p>{item.quantity} × {item.price.toLocaleString('ru-RU')} ₽</p>
        </div>
      </article>
    ))}
  </div>
);

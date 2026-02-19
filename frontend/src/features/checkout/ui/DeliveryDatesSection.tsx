import type { CheckoutDto } from '../api/checkoutApi';
import styles from './DeliveryDatesSection.module.css';

type Props = { items: CheckoutDto['cartItems'] };

export const DeliveryDatesSection = ({ items }: Props) => (
  <div className={styles.block}>
    <h3>Сроки доставки</h3>
    {items.map((item) => {
      const etaLabel =
        typeof item.etaMinDays === 'number'
          ? `Ориентировочно: ${item.etaMinDays}${item.etaMaxDays && item.etaMaxDays !== item.etaMinDays ? `–${item.etaMaxDays}` : ''} дн.`
          : 'Доставка рассчитывается при оформлении';
      return (
        <p key={item.productId}>
          {item.title}: Изготовление {item.productionTimeHours} ч. {etaLabel}
        </p>
      );
    })}
  </div>
);

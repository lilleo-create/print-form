import { formatDeliveryDate } from '../lib/formatDeliveryDate';
import type { CheckoutDto } from '../api/checkoutApi';
import styles from './DeliveryDatesSection.module.css';

type Props = { items: CheckoutDto['cartItems'] };

export const DeliveryDatesSection = ({ items }: Props) => {
  const groups = items.reduce<Record<string, string[]>>((acc, item) => {
    const key = formatDeliveryDate(item.deliveryDate, item.deliveryEtaDays);
    acc[key] = [...(acc[key] ?? []), item.title];
    return acc;
  }, {});

  const entries = Object.entries(groups);

  return (
    <div className={styles.block}>
      <h3>Сроки доставки</h3>
      {entries.length === 1 ? <p>Все товары: {entries[0][0]}</p> : entries.map(([date, titles]) => <p key={date}>{titles.join(', ')}: {date}</p>)}
    </div>
  );
};

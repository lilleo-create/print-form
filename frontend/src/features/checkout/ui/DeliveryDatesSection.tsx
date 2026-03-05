import type { CheckoutDto } from '../api/checkoutApi';
import styles from './DeliveryDatesSection.module.css';
import {
  formatCarrierDeliveryLabel,
  formatReadyToShipLabel
} from '../../../shared/lib/dateLabels';

type Props = { items: CheckoutDto['cartItems'] };

export const DeliveryDatesSection = ({ items }: Props) => (
  <div className={styles.block}>
    <h3>Сроки доставки</h3>
    {items.map((item) => {
      const readyLabel = formatReadyToShipLabel(item.productionTimeHours);
      const carrierLabel = formatCarrierDeliveryLabel(
        undefined,
        item.etaMinDays
      );
      return (
        <p key={item.productId}>
          {item.title}: Готово к отправке: {readyLabel}. СДЭК: {carrierLabel}
        </p>
      );
    })}
  </div>
);

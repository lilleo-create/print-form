import type { DeliveryMethodCode } from '../api/checkoutApi';
import type { CheckoutDto } from '../api/checkoutApi';
import styles from './DeliveryMethodSelector.module.css';

type Props = {
  methods: CheckoutDto['deliveryMethods'];
  selected: string;
  onSelect: (code: DeliveryMethodCode) => void;
};

const methodLabels: Record<DeliveryMethodCode, string> = {
  COURIER: 'Курьером',
  PICKUP_POINT: 'В пункт выдачи'
};

export const DeliveryMethodSelector = ({ methods, selected, onSelect }: Props) => {
  const pickupPoint = methods.find((method) => method.code === 'PICKUP_POINT');

  return (
    <div className={styles.wrap}>
      {/* Courier — disabled until available */}
      <button type="button" className={styles.item} disabled>
        <span>{methodLabels.COURIER}</span>
        <small>Появится позже</small>
      </button>

      {/* Pickup point */}
      <button
        type="button"
        className={selected === 'PICKUP_POINT' ? styles.active : styles.item}
        onClick={() => onSelect('PICKUP_POINT')}
        disabled={!pickupPoint}
      >
        <span>{methodLabels.PICKUP_POINT}</span>
        <small>{pickupPoint?.description ?? 'Выберите пункт CDEK'}</small>
      </button>
    </div>
  );
};

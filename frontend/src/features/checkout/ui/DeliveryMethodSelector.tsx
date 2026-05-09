import type { DeliveryMethodCode, CheckoutDto } from '../api/checkoutApi';
import styles from './DeliveryMethodSelector.module.css';

type Props = {
  methods: CheckoutDto['deliveryMethods'];
  selected: string;
  onSelect: (code: DeliveryMethodCode) => void;
};

const ALL_METHODS: { code: DeliveryMethodCode; label: string }[] = [
  { code: 'PICKUP_POINT', label: 'В пункт выдачи' },
  { code: 'COURIER', label: 'Курьером' },
];

export const DeliveryMethodSelector = ({ methods, selected, onSelect }: Props) => (
  <div className={styles.carousel}>
    {ALL_METHODS.map(({ code, label }) => {
      const method = methods.find((m) => m.code === code);
      const isCourier = code === 'COURIER';
      const isActive = selected === code && !isCourier;
      const isDisabled = isCourier || !method;
      return (
        <button
          key={code}
          type="button"
          className={isActive ? styles.cardActive : styles.card}
          disabled={isDisabled}
          onClick={() => !isDisabled && onSelect(code)}
        >
          <span className={styles.cardLabel}>{label}</span>
          <span className={styles.cardDate}>
            {isCourier ? 'Появится позже' : (method?.description ?? 'Послезавтра')}
          </span>
        </button>
      );
    })}
  </div>
);

import type { CheckoutDto } from '../api/checkoutApi';
import styles from './DeliveryMethodSelector.module.css';

type Props = {
  methods: CheckoutDto['deliveryMethods'];
  selected: string;
  onSelect: (code: 'ADDRESS' | 'PICKUP') => void;
};

export const DeliveryMethodSelector = ({ methods, selected, onSelect }: Props) => (
  <div className={styles.wrap}>
    {methods.map((method) => (
      <button
        key={method.id}
        type="button"
        className={selected === method.code ? styles.active : styles.item}
        onClick={() => onSelect(method.code)}
      >
        <span>{method.title}</span>
        <small>{method.description}</small>
      </button>
    ))}
  </div>
);

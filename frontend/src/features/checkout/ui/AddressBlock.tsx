import type { CheckoutDto } from '../api/checkoutApi';
import styles from './AddressBlock.module.css';

type Props = { address: CheckoutDto['address']; onEdit: () => void };

export const AddressBlock = ({ address, onEdit }: Props) => (
  <button type="button" onClick={onEdit} className={styles.block}>
    <strong>Адрес доставки</strong>
    <span>{address ? `${address.line1}, ${address.city}` : 'Выберите адрес доставки'}</span>
  </button>
);

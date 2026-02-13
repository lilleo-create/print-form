import type { PickupPoint } from '../api/checkoutApi';
import styles from './PickupPointBlock.module.css';

type Props = { point?: PickupPoint | null; onOpen: () => void };

export const PickupPointBlock = ({ point, onOpen }: Props) => (
  <button type="button" className={styles.block} onClick={onOpen}>
    <strong>Пункт выдачи</strong>
    <span>{point ? `${point.fullAddress} (ID: ${point.id})` : 'Выберите пункт выдачи'}</span>
  </button>
);

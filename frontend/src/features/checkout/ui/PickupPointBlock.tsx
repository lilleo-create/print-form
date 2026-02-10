import type { PickupPointDto } from '../api/checkoutApi';
import styles from './PickupPointBlock.module.css';

type Props = { point?: PickupPointDto | null; onOpen: () => void };

export const PickupPointBlock = ({ point, onOpen }: Props) => (
  <button type="button" className={styles.block} onClick={onOpen}>
    <strong>Пункт выдачи</strong>
    <span>{point ? `${point.title ?? point.provider}: ${point.address}` : 'Выберите пункт выдачи'}</span>
  </button>
);

import type { PickupPointDto } from '../api/checkoutApi';
import styles from './PickupMap.module.css';

type Props = { points: PickupPointDto[]; selectedId?: string; onSelect: (id: string) => void };

export const PickupMap = ({ points, selectedId, onSelect }: Props) => (
  <div className={styles.map}>
    {points.map((point) => (
      <button key={point.id} type="button" onClick={() => onSelect(point.id)} className={selectedId === point.id ? styles.active : styles.pin}>
        {point.provider}: {point.lat.toFixed(3)}, {point.lng.toFixed(3)}
      </button>
    ))}
  </div>
);

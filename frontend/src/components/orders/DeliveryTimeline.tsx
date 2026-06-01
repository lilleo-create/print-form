import type { DeliveryEvent } from '../../shared/types';
import styles from './DeliveryTimeline.module.css';

type Props = {
  events: DeliveryEvent[];
  cdekStatus?: string | null;
};

const formatEventTime = (timestampUtc: string | null, createdAt: string) => {
  const src = timestampUtc ?? createdAt;
  try {
    return new Date(src).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

export const DeliveryTimeline = ({ events, cdekStatus }: Props) => {
  if (events.length === 0) {
    if (!cdekStatus) {
      return <p className={styles.empty}>СДЭК-заявка ещё не создана</p>;
    }
    return <p className={styles.empty}>Ожидаем событий от СДЭК</p>;
  }

  // Показываем по убыванию — свежие события первыми
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.timestampUtc ?? a.createdAt).getTime();
    const tb = new Date(b.timestampUtc ?? b.createdAt).getTime();
    return tb - ta;
  });

  return (
    <div className={styles.wrap}>
      {sorted.map((event, i) => (
        <div key={event.id} className={styles.event}>
          <div className={styles.dotCol}>
            <span className={`${styles.dot} ${i === 0 ? styles.dotActive : ''}`} />
          </div>
          <div className={styles.body}>
            <p className={styles.description}>{event.description}</p>
            <p className={styles.time}>{formatEventTime(event.timestampUtc, event.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

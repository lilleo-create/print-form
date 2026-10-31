import type { Order } from '../../shared/types';
import { getOrderSteps } from '../../shared/lib/orderPresentation';
import styles from './OrderTimeline.module.css';

export const OrderTimeline = ({ order, role }: { order: Order; role: 'seller' | 'buyer' }) => (
  <ol className={styles.timeline} aria-label="Этапы заказа">
    {getOrderSteps(order, role).map(step => (
      <li key={step.key} className={`${styles.step} ${step.complete ? styles.complete : ''} ${step.current ? styles.current : ''}`}>
        <span className={styles.dot} aria-hidden="true" />
        <div><strong>{step.label}</strong>{step.date && step.complete ? <time dateTime={step.date}>{new Date(step.date).toLocaleString('ru-RU')}</time> : null}</div>
      </li>
    ))}
  </ol>
);

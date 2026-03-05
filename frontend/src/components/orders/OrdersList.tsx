import type { Order } from '../../shared/types';
import { OrderCard } from './OrderCard';
import styles from './OrdersComponents.module.css';

interface OrdersListProps {
  orders: Order[];
}

export const OrdersList = ({ orders }: OrdersListProps) => {
  if (orders.length === 0) {
    return <p className={styles.empty}>У вас пока нет заказов.</p>;
  }

  return (
    <div className={styles.list}>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
};

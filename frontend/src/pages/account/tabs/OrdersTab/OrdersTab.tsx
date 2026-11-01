import { useSearchParams } from 'react-router-dom';
import type { Order } from '../../../../shared/types';
import { OrdersList } from '../../../../components/orders/OrdersList';
import styles from './OrdersTab.module.css';

interface OrdersTabProps { orders: Order[] }

export const OrdersTab = ({ orders }: OrdersTabProps) => {
  const [searchParams] = useSearchParams();
  return <div className={styles.section}>
    <OrdersList orders={orders} highlightedOrderId={searchParams.get('orderId')} />
  </div>;
};

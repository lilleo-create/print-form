import { useSearchParams } from 'react-router-dom';
import type { Order } from '../../../../shared/types';
import { OrdersList } from '../../../../components/orders/OrdersList';
import styles from './OrdersTab.module.css';

interface OrdersTabProps { orders: Order[]; onPaymentExpired?: () => void }

export const OrdersTab = ({ orders, onPaymentExpired }: OrdersTabProps) => {
  const [searchParams] = useSearchParams();
  return <div className={styles.section}>
    <OrdersList orders={orders} highlightedOrderId={searchParams.get('orderId')} onPaymentExpired={onPaymentExpired} />
  </div>;
};

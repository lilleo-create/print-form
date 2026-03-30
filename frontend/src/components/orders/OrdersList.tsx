import { useEffect, useRef } from 'react';
import type { Order } from '../../shared/types';
import { OrderCompactCard } from './OrderCompactCard';
import styles from './OrdersComponents.module.css';

interface OrdersListProps {
  orders: Order[];
  highlightedOrderId?: string | null;
  activeReturnOrderIds?: Set<string>;
  onCancelOrder?: (order: Order) => void;
  onRetryPayment?: (orderId: string) => void;
}

export const OrdersList = ({
  orders,
  highlightedOrderId = null,
  activeReturnOrderIds,
  onCancelOrder,
  onRetryPayment
}: OrdersListProps) => {
  const orderNodesRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!highlightedOrderId) return;
    const targetNode = orderNodesRef.current[highlightedOrderId];
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedOrderId, orders]);

  if (orders.length === 0) {
    return <p className={styles.empty}>У вас пока нет заказов.</p>;
  }

  return (
    <div className={styles.list}>
      {orders.map((order) => (
        <div
          key={order.id}
          ref={(node) => {
            orderNodesRef.current[order.id] = node;
          }}
        >
          <OrderCompactCard
            order={order}
            highlighted={highlightedOrderId === order.id}
            hasActiveReturn={Boolean(activeReturnOrderIds?.has(order.id))}
            onCancelOrder={onCancelOrder}
            onRetryPayment={onRetryPayment}
          />
        </div>
      ))}
    </div>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Order, ReturnRequest } from '../../../../shared/types';
import { api } from '../../../../shared/api';
import styles from './OrdersTab.module.css';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';
import { ordersApi } from '../../../../shared/api/ordersApi';
import { useOrdersStore } from '../../../../app/store/ordersStore';
import { OrdersList } from '../../../../components/orders/OrdersList';

interface OrdersTabProps {
  orders: Order[];
}

export const OrdersTab = ({ orders }: OrdersTabProps) => {
  const [searchParams] = useSearchParams();
  const navigateOrderId = searchParams.get('orderId');
  const updateOrder = useOrdersStore((state) => state.updateOrder);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    api.returns
      .listMy()
      .then((response) => {
        setReturns(response.data ?? []);
      })
      .catch(() => {
        setReturns([]);
      });
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const activeReturnOrderIds = useMemo(() => {
    const activeStatuses = new Set(['CREATED', 'UNDER_REVIEW', 'APPROVED']);
    return new Set(
      returns
        .filter((request) => activeStatuses.has(request.status))
        .flatMap((request) =>
          (request.items ?? [])
            .map((item) => item.orderItem?.order?.id)
            .filter((value): value is string => Boolean(value))
        )
    );
  }, [returns]);

  const handleCancelOrder = async () => {
    if (!cancelModalOrder) return;
    setIsCancelling(true);
    try {
      const updatedOrder = await ordersApi.cancelMyOrder(cancelModalOrder.id);
      updateOrder(updatedOrder);
      setToastMessage('Возврат оформлен. Деньги вернутся тем же способом оплаты.');
      setCancelModalOrder(null);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryPayment = async (orderId: string) => {
    try {
      const response = await api.retryMyOrderPayment(orderId);
      const paymentUrl = response.data?.paymentUrl;
      if (paymentUrl) {
        window.location.assign(paymentUrl);
      }
    } catch {
      // интеграционная точка: backend endpoint должен вернуть paymentUrl и/или обновлённый заказ
    }
  };

  return (
    <div className={styles.section}>
      <OrdersList
        orders={orders}
        highlightedOrderId={navigateOrderId}
        activeReturnOrderIds={activeReturnOrderIds}
        onCancelOrder={(order) => setCancelModalOrder(order)}
        onRetryPayment={(orderId) => {
          handleRetryPayment(orderId).catch(() => undefined);
        }}
      />

      <Modal isOpen={Boolean(cancelModalOrder)} onClose={() => setCancelModalOrder(null)}>
        <div className={styles.cancelModal}>
          <h3>Отменить заказ и вернуть деньги?</h3>
          <p className={styles.caption}>Деньги вернутся тем же способом оплаты.</p>
          <div className={styles.modalActions}>
            <Button type="button" onClick={handleCancelOrder} isLoading={isCancelling}>
              Подтвердить
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCancelModalOrder(null)} disabled={isCancelling}>
              Не отменять
            </Button>
          </div>
        </div>
      </Modal>
      {toastMessage ? <p className={styles.toast}>{toastMessage}</p> : null}
    </div>
  );
};

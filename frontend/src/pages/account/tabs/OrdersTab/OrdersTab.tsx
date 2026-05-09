import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Order, ReturnRequest } from '../../../../shared/types';
import { api } from '../../../../shared/api';
import styles from './OrdersTab.module.css';
import { Button } from '../../../../shared/ui/Button';
import { useBodyScrollLock } from '../../../../shared/lib/useBodyScrollLock';
import { ordersApi } from '../../../../shared/api/ordersApi';
import { useOrdersStore } from '../../../../app/store/ordersStore';
import { OrdersList } from '../../../../components/orders/OrdersList';

type CancelSheetProps = {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const CancelSheet = ({ isOpen, isLoading, onConfirm, onClose }: CancelSheetProps) => {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.sheetOverlay}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.sheet}>
        <div className={styles.sheetHandle} />
        <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
        <div className={styles.sheetInner}>
          <h3 className={styles.sheetTitle}>Отменить заказ и вернуть деньги?</h3>
          <p className={styles.sheetCaption}>Деньги вернутся тем же способом оплаты.</p>
          <div className={styles.sheetActions}>
            <Button type="button" onClick={onConfirm} isLoading={isLoading}>
              Подтвердить
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Не отменять
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

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

      <CancelSheet
        isOpen={Boolean(cancelModalOrder)}
        isLoading={isCancelling}
        onConfirm={handleCancelOrder}
        onClose={() => setCancelModalOrder(null)}
      />
      {toastMessage ? <p className={styles.toast}>{toastMessage}</p> : null}
    </div>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { Order, ReturnRequest } from '../../../../shared/types';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import {
  getDeliveryStatusLabel,
  hasHandoverStarted
} from '../../../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../../../shared/lib/deliveryLabel';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../shared/api';
import styles from './OrdersTab.module.css';
import { formatPrice } from '../../../../utils/money';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';
import { ordersApi } from '../../../../shared/api/ordersApi';
import { useOrdersStore } from '../../../../app/store/ordersStore';

interface OrdersTabProps {
  orders: Order[];
}

export const OrdersTab = ({ orders }: OrdersTabProps) => {
  const navigate = useNavigate();
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

  const getPaymentStatusLabel = (paymentStatus?: string | null) => {
    switch (paymentStatus) {
      case 'PAID':
        return 'Оплачено';
      case 'REFUND_PENDING':
        return 'Возврат обрабатывается';
      case 'REFUNDED':
        return 'Деньги возвращены';
      case 'PARTIALLY_REFUNDED':
        return 'Частичный возврат';
      case 'PAYMENT_EXPIRED':
        return 'Оплата не прошла';
      case 'PENDING':
      default:
        return 'Ожидает оплаты';
    }
  };

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
      {orders.length === 0 ? (
        <p className={styles.empty}>Активных заказов нет.</p>
      ) : (
        <div className={styles.ordersList}>
          {orders.map((order) => {
            const product = order.items[0];
            const imageSrc = resolveImageUrl(product?.image);
            const isPaid = order.paymentStatus === 'PAID';
            const isCancelled = order.status === 'CANCELLED';
            const isRefundPending = order.paymentStatus === 'REFUND_PENDING';
            const isRefunded = order.paymentStatus === 'REFUNDED';
            const hasActiveReturn = activeReturnOrderIds.has(order.id);
            const isShipped = hasHandoverStarted(order);
            const refundStatusText = isRefundPending
              ? 'Возврат обрабатывается'
              : isRefunded
                ? 'Деньги возвращены'
                : null;
            const showCancelAction = !isCancelled && !isRefunded && !hasActiveReturn && isPaid && !isShipped;
            const showReturnAction = !isCancelled && !isRefunded && !hasActiveReturn && isPaid && isShipped;

            if (!product) return null;

            return (
              <article
                key={order.id}
                className={styles.orderCard}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/product/${product.productId}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/product/${product.productId}`);
                  }
                }}
              >
                <div className={styles.orderHeader}>
                  <div>
                    <h3>Заказ №{order.id}</h3>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className={styles.total}>{formatPrice(order.total)} ₽</div>
                </div>

                <div className={styles.productCard}>
                  {imageSrc ? (
                    <img className={styles.productImage} src={imageSrc} alt={product.title} />
                  ) : (
                    <div className={styles.imagePlaceholder} aria-hidden="true" />
                  )}
                  <div className={styles.itemInfo}>
                    <strong>{product.title}</strong>
                    <span>{formatPrice(product.price)} ₽</span>
                    {order.items.length > 1 ? <span className={styles.caption}>+ еще {order.items.length - 1}</span> : null}
                  </div>
                </div>

                <p className={styles.status}>Статус доставки: {getDeliveryStatusLabel(order)}</p>
                <p className={order.paymentStatus === 'PAID' ? styles.caption : styles.unpaidStatus}>
                  Статус оплаты: {getPaymentStatusLabel(order.paymentStatus)}
                </p>
                {order.trackingNumber ? <p className={styles.caption}>СДЭК: {order.trackingNumber}</p> : null}
                {getOrderDeliveryLabel(order) ? <p className={styles.caption}>{getOrderDeliveryLabel(order)}</p> : null}
                {order.isExpired && order.canRetryPayment ? (
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRetryPayment(order.id).catch(() => undefined);
                    }}
                  >
                    Повторить оплату
                  </button>
                ) : null}

                {isCancelled && refundStatusText ? (
                  <button type="button" className={styles.actionButtonSecondary} disabled>
                    {refundStatusText}
                  </button>
                ) : null}

                {!isCancelled && isRefunded ? (
                  <button type="button" className={styles.actionButtonSecondary} disabled>
                    Деньги возвращены
                  </button>
                ) : null}

                {!isCancelled && !isRefunded && hasActiveReturn ? (
                  <button type="button" className={styles.actionButtonSecondary} disabled>
                    Возврат оформлен
                  </button>
                ) : null}

                {showCancelAction ? (
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCancelModalOrder(order);
                    }}
                  >
                    Отменить заказ
                  </button>
                ) : null}

                {showReturnAction ? (
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/returns?orderId=${order.id}`);
                    }}
                  >
                    Оформить возврат
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
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

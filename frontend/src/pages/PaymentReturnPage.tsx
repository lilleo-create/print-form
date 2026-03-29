import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import { formatPrice } from '../utils/money';
import styles from './PaymentReturnPage.module.css';

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 15;

const getPaymentStatusLabel = (paymentStatus?: string | null) => {
  switch (paymentStatus) {
    case 'PAID':
      return 'Оплата прошла успешно';
    case 'PENDING':
      return 'Оплата не завершена';
    case 'PAYMENT_EXPIRED':
      return 'Оплата не завершена';
    default:
      return 'Оплата не завершена';
  }
};

const isPendingPayment = (order: Order | null) => order?.paymentStatus === 'PENDING';

export const PaymentReturnPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? searchParams.get('order_id') ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      if (!orderId) {
        setError('Не найден номер заказа в параметрах возврата.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let latest = await ordersApi.getById(orderId);
        if (cancelled) return;
        setOrder(latest);

        let attempt = 0;
        while (attempt < MAX_POLLING_ATTEMPTS && isPendingPayment(latest) && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
          latest = await ordersApi.getById(orderId);
          if (cancelled) return;
          setOrder(latest);
          attempt += 1;
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось получить статус оплаты.'
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const title = useMemo(() => {
    if (error) return 'Оплата не завершена';
    if (isLoading && !order) return 'Проверяем статус оплаты…';
    return getPaymentStatusLabel(order?.paymentStatus);
  }, [error, isLoading, order]);

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {orderId ? <p className={styles.meta}>Заказ: {orderId}</p> : null}
          {order?.paymentStatus ? (
            <p className={styles.meta}>Текущий статус: {order.paymentStatus}</p>
          ) : null}
          {order ? (
            <p className={styles.meta}>Сумма: {formatPrice(order.total)} ₽</p>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>
    </section>
  );
};

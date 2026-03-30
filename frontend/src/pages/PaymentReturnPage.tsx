import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import styles from './PaymentReturnPage.module.css';

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 15;

const isPendingPayment = (order: Order | null) => order?.paymentStatus === 'PENDING';
const isPaidPayment = (order: Order | null) => order?.paymentStatus === 'PAID';

export const PaymentReturnPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? searchParams.get('order_id') ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      if (!orderId) {
        setError('Не найден номер заказа.');
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
      } catch {
        if (cancelled) return;
        setError('Не удалось проверить статус оплаты. Попробуйте открыть заказ позже.');
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

  const isPaid = useMemo(() => isPaidPayment(order), [order]);

  const title = isPaid
    ? 'Спасибо! Мы приняли оплату и передали заказ продавцу'
    : 'Платеж еще обрабатывается';
  const subtitle = isPaid
    ? 'Продавец уже получил заказ и скоро начнет работу'
    : 'Это обычно занимает немного времени. Статус можно проверить в заказе.';

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.layout}>
          <div className={styles.card}>
            <div className={styles.iconWrap} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" className={styles.icon}>
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 className={styles.title}>{isLoading ? 'Проверяем оплату…' : title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <Button
                type="button"
                onClick={() => navigate(`/orders/${orderId}`)}
                disabled={!orderId}
                className={styles.actionButton}
              >
                Перейти к заказу
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/')}
                className={styles.actionButton}
              >
                На главную
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

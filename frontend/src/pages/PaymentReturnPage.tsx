import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import styles from './PaymentReturnPage.module.css';
import CheckIcon from '@shared/assets/check.svg?react';

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 15;

export const PaymentReturnPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pollingFinished, setPollingFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loadOrder = async () => {
      setOrder(null);
      setPollingFinished(false);
      if (!orderId) {
        setError('Не указан номер заказа.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let latest = await ordersApi.getById(orderId);
        if (cancelled) return;
        setOrder(latest);
        setIsLoading(false);

        for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS && latest.paymentStatus === 'PENDING_PAYMENT'; attempt += 1) {
          await new Promise<void>((resolve) => {
            timer = setTimeout(resolve, POLLING_INTERVAL_MS);
          });
          if (cancelled) return;
          latest = await ordersApi.getById(orderId);
          if (cancelled) return;
          setOrder(latest);
        }
        if (!cancelled) setPollingFinished(true);
      } catch {
        if (cancelled) return;
        setError('Не удалось получить статус заказа. Попробуйте открыть заказ позже.');
        setIsLoading(false);
      }
    };

    void loadOrder();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  let title = 'Проверяем оплату…';
  let subtitle = '';
  if (error) {
    title = 'Не удалось проверить оплату';
  } else if (!isLoading && order) {
    switch (order.paymentStatus) {
      case 'PAID':
        title = 'Заказ оплачен';
        subtitle = 'Спасибо! Мы приняли оплату и передали заказ продавцу';
        break;
      case 'PENDING_PAYMENT':
        title = pollingFinished ? 'Платеж еще обрабатывается' : 'Проверяем оплату…';
        subtitle = pollingFinished
          ? 'Платеж еще обрабатывается. Статус можно проверить в заказе.'
          : 'Ожидаем подтверждение платежа.';
        break;
      case 'PAYMENT_EXPIRED':
        title = 'Время на оплату истекло';
        subtitle = 'Проверьте заказ, чтобы узнать о доступных действиях.';
        break;
      case 'CANCELLED':
        title = 'Платеж отменен';
        subtitle = 'Проверьте заказ, чтобы узнать о доступных действиях.';
        break;
      default:
        title = 'Статус оплаты неизвестен';
        subtitle = 'Проверьте актуальный статус в заказе.';
    }
  }

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.layout}>
          <div className={styles.card}>
            <div className={styles.iconWrap}>
              <CheckIcon className={styles.icon} />
            </div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <Button
                type="button"
                onClick={() => navigate(`/account?tab=orders&orderId=${encodeURIComponent(orderId)}`)}
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

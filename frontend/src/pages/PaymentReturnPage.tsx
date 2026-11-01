import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import type { Product } from '../shared/types';
import { api } from '../shared/api';
import { rankOrderRecommendations } from '../shared/lib/orderRecommendations';
import { formatPriceWithKopecks } from '../shared/lib/formatPrice';
import styles from './PaymentReturnPage.module.css';
import CheckIcon from '@shared/assets/check.svg?react';
import { PaymentCountdown } from '../components/orders/PaymentCountdown';

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
  const [countdownExpired, setCountdownExpired] = useState(false);
  const [recommendations, setRecommendations] = useState<Product[]>([]);

  useEffect(() => {
    if (order?.paymentStatus !== 'PAID') return;
    let active = true;
    void (async () => {
      try {
        const purchased = await Promise.all((order.items ?? []).slice(0, 3).map(item => api.getProduct(item.productId).then(result => result.data).catch(() => null)));
        const categories = [...new Set(purchased.filter((product): product is Product => Boolean(product)).map(product => product.category))];
        const [categoryProducts, catalog] = await Promise.all([
          Promise.all(categories.map(category => api.getProducts({ categories: [category], limit: 12 }).then(result => result.data).catch(() => [] as Product[]))),
          api.getProducts({ sort: 'createdAt', order: 'desc', limit: 40 })
        ]);
        const candidates = [...new Map([...categoryProducts.flat(), ...catalog.data].map(product => [product.id, product])).values()];
        if (active) setRecommendations(rankOrderRecommendations(order, candidates, 6, categories));
      } catch { if (active) setRecommendations([]); }
    })();
    return () => { active = false; };
  }, [order?.paymentStatus, order?.id]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loadOrder = async () => {
      setOrder(null);
      setPollingFinished(false);
      setCountdownExpired(false);
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
        if (countdownExpired || order.isExpired) {
          title = 'Время на оплату истекло';
          subtitle = 'Проверяем статус платежа. Актуальные действия будут доступны в заказе.';
          break;
        }
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
            {order?.paymentStatus === 'PENDING_PAYMENT' && <p className={styles.subtitle}><PaymentCountdown paymentExpiresAt={order.paymentExpiresAt} onExpire={() => { setCountdownExpired(true); void ordersApi.getById(orderId).then(setOrder).catch(() => undefined); }} /></p>}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <Button
                type="button"
                onClick={() => navigate(`/account/orders/${encodeURIComponent(orderId)}`)}
                disabled={!orderId}
                className={styles.actionButton}
              >
                Перейти к заказу
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/catalog')}
                className={styles.actionButton}
              >
                Продолжить покупки
              </Button>
            </div>
            {order?.paymentStatus === 'PAID' && recommendations.length > 0 && <div className={styles.recommendations}>
              <h2>Может, что-то ещё?</h2><div className={styles.recommendationRow}>
                {recommendations.map(product => <button key={product.id} type="button" className={styles.recommendation} onClick={() => navigate(`/product/${product.id}`)}>
                  <img src={product.imageUrl || product.image} alt="" /><strong>{product.title}</strong><span>{formatPriceWithKopecks(product.price)}</span>
                </button>)}
              </div>
            </div>}
          </div>
        </div>
      </div>
    </section>
  );
};

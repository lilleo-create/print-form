import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../shared/api/ordersApi';
import { api } from '../shared/api';
import type { Order, ReturnRequest } from '../shared/types';
import { formatPriceWithKopecks } from '../shared/lib/formatPrice';
import { getHumanOrderStatus } from '../shared/lib/orderPresentation';
import { buyerCancellationAction } from '../shared/lib/paymentLifecycle';
import { OrderTimeline } from '../components/orders/OrderTimeline';
import { OrderHero } from '../components/orders/OrderHero';
import { PaymentCountdown } from '../components/orders/PaymentCountdown';
import styles from './OrderDetailPage.module.css';

export const BuyerOrderDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasActiveReturn, setHasActiveReturn] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  useEffect(() => { let active = true; void ordersApi.getById(id).then(value => { if (active) setOrder(value); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  useEffect(() => { let active = true; void api.returns.listMy().then(response => { if (!active) return; setHasActiveReturn((response.data as ReturnRequest[] ?? []).some(request => ['CREATED', 'UNDER_REVIEW', 'APPROVED'].includes(request.status) && (request.items ?? []).some(item => item.orderItem?.order?.id === id))); }).catch(() => undefined); return () => { active = false; }; }, [id]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') navigate('/account?tab=orders'); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [navigate]);
  if (loading) return <main className={styles.page}><p>Загружаем заказ…</p></main>;
  if (error || !order) return <main className={styles.page}><button onClick={() => navigate('/account?tab=orders')}>← К заказам</button><h1>Заказ не найден</h1></main>;
  const amount = (value: number) => formatPriceWithKopecks(value);
  const delivered = order.status === 'DELIVERED';
  const deliveryDate = delivered && order.deliveredToRecipientAt ? new Date(order.deliveredToRecipientAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : null;
  const cancellationAction = buyerCancellationAction(order);
  const canCancel = cancellationAction === 'cancel' && !hasActiveReturn;
  const canReturn = order.status === 'DELIVERED' && order.paymentStatus === 'PAID' && !hasActiveReturn;
  const delivery = <section className={styles.card}><h2>Доставка</h2><dl><dt>Получение</dt><dd>Пункт выдачи CDEK</dd><dt>Адрес ПВЗ</dt><dd>{order.buyerPickupPvzMeta?.addressFull || '—'}</dd>{deliveryDate && <><dt>Получен</dt><dd>{deliveryDate}</dd></>}<dt>Статус</dt><dd>{getHumanOrderStatus(order)}</dd>{order.trackingNumber && <><dt>Трек CDEK</dt><dd><a href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(order.trackingNumber)}`} target="_blank" rel="noreferrer">{order.trackingNumber}</a></dd></>}</dl></section>;
  const recipient = <section className={styles.card}><h2>Получатель</h2><p>{order.recipientName || '—'}</p><p>{order.recipientPhone || '—'}</p><p>{order.recipientEmail || '—'}</p></section>;
  const help = <section className={styles.card}><h2>Помощь</h2><button className={styles.textButton} onClick={() => navigate('/account?tab=chats')}>Написать в поддержку</button></section>;
  const summary = <section className={`${styles.card} ${styles.summaryCard}`}><h2>Сумма заказа</h2><dl><dt>Товары</dt><dd>{amount(order.financials?.itemsSubtotal ?? order.total)}</dd><dt>Доставка</dt><dd>{order.financials?.deliveryAmount ? amount(order.financials.deliveryAmount) : 'Бесплатно'}</dd><dt className={styles.strong}>Итого</dt><dd className={styles.strong}>{amount(order.financials?.total ?? order.total)}</dd></dl>
    {order.status === 'CREATED' && order.paymentStatus === 'PENDING_PAYMENT' && <p><PaymentCountdown paymentExpiresAt={order.paymentExpiresAt} onExpire={() => { void ordersApi.getById(id).then(setOrder).catch(() => undefined); }} /></p>}
    <div className={styles.detailActions}>{order.items.map(item => <div key={item.id || item.productId} className={styles.productActionGroup}>
      {order.items.length > 1 && <span>{item.title}</span>}
      <button className={styles.textButton} onClick={() => navigate(`/product/${item.productId}`)}>Купить ещё раз</button>
      {delivered && <button className={styles.textButton} onClick={() => navigate(`/product/${item.productId}/reviews`)}>Оставить отзыв</button>}
    </div>)}
      {canCancel && <button className={styles.textButton} onClick={() => navigate(`/cancel?orderId=${order.id}`)}>Отменить заказ</button>}
      {cancellationAction === 'request' && <button className={styles.textButton} onClick={() => navigate(`/account?tab=chats&draft=${encodeURIComponent(`Хочу отменить заказ ${order.publicNumber || order.id}.`)}`)}>Запросить отмену</button>}
      {canReturn && <button className={styles.textButton} onClick={() => navigate(`/account?tab=returns&orderId=${order.id}`)}>Оформить возврат</button>}
      {order.status === 'EXPIRED' && order.canRetryPayment && <button className={styles.textButton} disabled={retryBusy} onClick={() => { setRetryBusy(true); setRetryError(null); void api.retryMyOrderPayment(order.id).then(response => { if (response.data?.paymentUrl) window.location.assign(response.data.paymentUrl); else void ordersApi.getById(id).then(setOrder); }).catch(() => setRetryError('Не удалось начать оплату. Обновите заказ и попробуйте снова.')).finally(() => setRetryBusy(false)); }}>Оплатить снова</button>}
      {retryError && <p role="alert">{retryError}</p>}
    </div>
  </section>;

  return <main className={styles.page}>
    <button className={styles.back} onClick={() => navigate('/account?tab=orders')}>← К заказам</button>
    {delivered && <div className={styles.deliveredHeading}><span className={styles.deliveredIcon} aria-hidden="true">✓</span><div><h2>Получен{deliveryDate ? ` ${deliveryDate}` : ''}</h2><p>Заказ доставлен</p></div></div>}
    <OrderHero order={order} audience="buyer" />
    <div className={styles.grid}><div className={styles.main}>
      {!delivered && <section className={styles.card}><h2>Этапы заказа</h2><OrderTimeline order={order} role="buyer" /></section>}
      {delivery}
      {recipient}
      {help}
    </div><aside className={styles.side}>{summary}</aside></div>
  </main>;
};

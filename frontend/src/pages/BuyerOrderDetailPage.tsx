import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import { formatPriceWithKopecks } from '../shared/lib/formatPrice';
import { getHumanOrderStatus } from '../shared/lib/orderPresentation';
import { OrderTimeline } from '../components/orders/OrderTimeline';
import styles from './OrderDetailPage.module.css';

export const BuyerOrderDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; void ordersApi.getById(id).then(value => { if (active) setOrder(value); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') navigate('/account?tab=orders'); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [navigate]);
  if (loading) return <main className={styles.page}><p>Загружаем заказ…</p></main>;
  if (error || !order) return <main className={styles.page}><button onClick={() => navigate('/account?tab=orders')}>← К заказам</button><h1>Заказ не найден</h1></main>;
  const amount = (value: number) => formatPriceWithKopecks(value);
  return <main className={styles.page}>
    <button className={styles.back} onClick={() => navigate('/account?tab=orders')}>← К заказам</button>
    <header className={styles.hero}><div><span className={styles.eyebrow}>ВАШ ЗАКАЗ</span><h1>{order.publicNumber || order.id}</h1><p>{new Date(order.createdAt).toLocaleString('ru-RU')}</p></div><strong className={styles.status}>{getHumanOrderStatus(order)}</strong></header>
    <div className={styles.grid}><div className={styles.main}>
      <section className={styles.card}><h2>Этапы заказа</h2><OrderTimeline order={order} role="buyer" /></section>
      <section className={styles.card}><h2>Товары</h2>{order.items.map(item => <div key={item.id || item.productId} className={styles.product}>{item.image && <img src={item.image} alt="" />}<div><strong>{item.title}</strong><p>{item.qty} шт. · {amount(item.priceKopecks ?? item.price)}</p><button className={styles.textButton} onClick={() => navigate(`/product/${item.productId}`)}>Купить ещё раз</button>{order.status === 'DELIVERED' && <button className={styles.textButton} onClick={() => navigate(`/product/${item.productId}/reviews`)}>Оставить отзыв</button>}</div></div>)}</section>
      <section className={styles.card}><h2>Доставка</h2><dl><dt>Стоимость для вас</dt><dd>{order.financials?.deliveryAmount ? amount(order.financials.deliveryAmount) : 'Бесплатно'}</dd><dt>Пункт выдачи</dt><dd>{order.buyerPickupPvzMeta?.addressFull || '—'}</dd><dt>Статус</dt><dd>{getHumanOrderStatus(order)}</dd>{order.trackingNumber && <><dt>Трек CDEK</dt><dd><a href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(order.trackingNumber)}`} target="_blank" rel="noreferrer">{order.trackingNumber}</a></dd></>}</dl></section>
    </div><aside className={styles.side}>
      <section className={styles.card}><h2>Сумма заказа</h2><strong className={styles.total}>{amount(order.financials?.total ?? order.total)}</strong></section>
      <section className={styles.card}><h2>Получатель</h2><p>{order.recipientName || '—'}</p><p>{order.recipientPhone || '—'}</p><p>{order.recipientEmail || '—'}</p></section>
      <section className={styles.card}><h2>Помощь</h2><button className={styles.textButton} onClick={() => navigate('/account?tab=chats')}>Написать в поддержку</button></section>
    </aside></div>
  </main>;
};

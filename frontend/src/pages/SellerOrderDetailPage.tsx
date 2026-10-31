import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import { getHumanOrderStatus, getSellerNextAction } from '../shared/lib/orderPresentation';
import { readyToShipDisabledReason } from '../shared/lib/orderFulfillment';
import { formatPriceWithKopecks } from '../shared/lib/formatPrice';
import { OrderTimeline } from '../components/orders/OrderTimeline';
import { PackedOrderModal } from '../components/orders/PackedOrderModal';
import { PackingGuideModal } from '../components/orders/PackingGuideModal';
import styles from './OrderDetailPage.module.css';

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const SellerOrderDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const sellerId = useAuthStore(state => state.user?.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [packing, setPacking] = useState(false);
  const [guide, setGuide] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const refresh = useCallback(async () => {
    if (!sellerId) return;
    const [detail, orders] = await Promise.all([
      ordersApi.getById(id),
      ordersApi.listBySeller(sellerId).catch(() => [] as Order[])
    ]);
    const listed = orders.find(item => item.id === id);
    setOrder({ ...detail, shipment: listed?.shipment ?? detail.shipment });
    setLoading(false);
  }, [id, sellerId]);
  useEffect(() => { void refresh().catch(() => { setLoading(false); setError('Не удалось загрузить заказ.'); }); }, [refresh]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !packing && !guide) navigate('/seller', { state: { activeTab: 'Заказы' } }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guide, navigate, packing]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); await refresh(); } catch { setError('Не удалось выполнить действие. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  };
  if (loading) return <main className={styles.page}><p>Загружаем заказ…</p></main>;
  if (!order) return <main className={styles.page}><button onClick={() => navigate(-1)}>← Назад</button><h1>Заказ не найден</h1></main>;
  const next = getSellerNextAction(order);
  const financials = order.financials;
  const amount = (value: number | null | undefined) => formatPriceWithKopecks(value ?? 0);
  const delivery = financials?.confirmedActualDeliveryAmount ?? financials?.cdekCurrentTotalAmount ??
    financials?.packedDeliveryAmount ?? financials?.checkoutDeliveryEstimateAmount ?? 0;
  const canDocuments = Boolean(order.shipment?.id && order.shipment.readbackStatus !== 'PENDING' && order.shipment.readbackStatus !== 'AUTH_FAILED');
  return <main className={styles.page}>
    <button className={styles.back} type="button" onClick={() => navigate('/seller', { state: { activeTab: 'Заказы' } })}>← К заказам</button>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>ЗАКАЗ ПРОДАВЦА</span><h1>{order.publicNumber || order.id}</h1>
        <p>{new Date(order.createdAt).toLocaleString('ru-RU')}</p></div>
      <div><strong className={styles.status}>{getHumanOrderStatus(order)}</strong>{order.trackingNumber && <p>Трек CDEK: {order.trackingNumber}</p>}</div>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.grid}>
      <div className={styles.main}>
        <section className={styles.card}><h2>Что дальше</h2>
          {next === 'production' && <button className={styles.primary} disabled={busy} onClick={() => void run(() => api.updateSellerOrderStatus(order.id, { status: 'PRINTING' }))}>Начать производство</button>}
          {next === 'pack' && <><button className={styles.primary} onClick={() => setPacking(true)}>Товар упакован</button><button className={styles.textButton} onClick={() => setGuide(true)}>Как правильно упаковать?</button></>}
          {next === 'shipment' && <><button className={styles.primary} disabled={busy || Boolean(readyToShipDisabledReason(order))} onClick={() => void run(() => ordersApi.readyToShip(order.id))}>Создать доставку в CDEK</button>{readyToShipDisabledReason(order) && <p>{readyToShipDisabledReason(order)}</p>}<button className={styles.textButton} onClick={() => setPacking(true)}>Изменить параметры посылки</button></>}
          {next === 'handoff' && <><h3>Передайте заказ в CDEK</h3><p>ПВЗ сдачи: {order.sellerDropoffPvzMeta?.addressFull || 'Уточняется'}</p>{order.dropoffDeadlineAt && <p>Сдать до: {new Date(order.dropoffDeadlineAt).toLocaleString('ru-RU')}</p>}<p>Трек: {order.trackingNumber || 'Формируется'}</p></>}
          {next === 'tracking' && <p>Следите за доставкой. Статус обновится автоматически.</p>}
          {next === null && <p>{getHumanOrderStatus(order)}</p>}
          {order.shipment?.id && <div className={styles.actionRow}>
            <button disabled={!canDocuments || !order.trackingNumber} onClick={() => void run(async () => download((await ordersApi.downloadShippingLabel(order.id)).blob, `label-${order.publicNumber || order.id}.pdf`))}>Скачать ярлык</button>
            <button disabled={!canDocuments} onClick={() => void run(async () => download(await api.downloadShipmentAct(order.shipment!.id) as Blob, `act-${order.publicNumber || order.id}.pdf`))}>Скачать акт</button>
            <div className={styles.menu}><button aria-label="Дополнительные действия" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>⋯</button>{menuOpen && <button onClick={() => { setMenuOpen(false); void run(() => order.shipment?.id ? ordersApi.syncShipment(order.shipment.id) : ordersApi.syncCdekOrder(order.id)); }}>Обновить статус доставки</button>}</div>
          </div>}
        </section>
        <section className={styles.card}><h2>Этапы заказа</h2><OrderTimeline order={order} role="seller" /></section>
        <section className={styles.card}><h2>Товары</h2>{order.items.map(item => <div key={item.id || item.productId} className={styles.product}>{item.image && <img src={item.image} alt="" />}<div><strong>{item.title}</strong><p>{item.qty} шт. · {amount(item.priceKopecks ?? item.price)}</p></div></div>)}</section>
        <section className={styles.card}><h2>Доставка</h2><dl><dt>ПВЗ сдачи</dt><dd>{order.sellerDropoffPvzMeta?.addressFull || '—'}</dd><dt>ПВЗ покупателя</dt><dd>{order.buyerPickupPvzMeta?.addressFull || '—'}</dd><dt>Статус</dt><dd>{getHumanOrderStatus(order)}</dd><dt>Трек CDEK</dt><dd>{order.trackingNumber || 'Формируется'}</dd>{order.packedWeightGrams && <><dt>Вес коробки</dt><dd>{order.packedWeightGrams} г</dd></>}</dl></section>
      </div>
      <aside className={styles.side}>
        <section className={styles.card}><h2>Получатель</h2><p>{order.recipientName || '—'}</p><p>{order.recipientPhone || '—'}</p><p>{order.recipientEmail || '—'}</p></section>
        <section className={styles.card}><h2>Расчёт продавца</h2><dl><dt>Товары</dt><dd>{amount(financials?.itemsSubtotal ?? order.total)}</dd><dt>Комиссия площадки и эквайринг</dt><dd>{amount((financials?.platformFeeAmount ?? 0) + (financials?.acquiringFeeAmount ?? 0))}</dd>
          {financials?.cdekCurrentTotalAmount != null ? <><dt>Тариф CDEK</dt><dd>{amount(financials.cdekBaseDeliveryAmount)}</dd><dt>Доп. услуги CDEK</dt><dd>{amount(financials.cdekAdditionalServicesAmount)}</dd><dt>{financials.confirmedActualDeliveryAmount != null ? 'Фактические расходы CDEK' : 'Итого CDEK'}</dt><dd>{amount(delivery)}</dd></> : <><dt>Расчётная доставка</dt><dd>{amount(delivery)}</dd></>}
          <dt className={styles.strong}>После расходов</dt><dd className={styles.strong}>{amount(financials?.sellerNetAfterDeliveryAmount ?? (financials?.sellerNetAmount ?? order.total) - delivery)}</dd></dl></section>
      </aside>
    </div>
    {packing && <PackedOrderModal initial={{ weightGrams: order.packedWeightGrams ?? undefined, lengthCm: order.packedLengthCm ?? undefined, widthCm: order.packedWidthCm ?? undefined, heightCm: order.packedHeightCm ?? undefined }} sellerNetBeforeDeliveryKopecks={financials?.sellerNetAmount ?? order.total} onClose={() => setPacking(false)} onQuote={async parcel => (await api.quotePackedOrder(order.id, parcel)).data} onConfirm={async (parcel, expectedAmount) => { await api.confirmPackedOrder(order.id, parcel, expectedAmount); await refresh(); setPacking(false); }} />}
    {guide && <PackingGuideModal onClose={() => setGuide(false)} />}
  </main>;
};

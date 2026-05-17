import { useEffect, useMemo, useState } from 'react';
import { useCheckoutStore } from '../model/useCheckoutStore';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import { AddressModal } from './AddressModal';
import { CdekPvzPickerModal } from '../../../components/checkout/CdekPvzPickerModal';
import { RecipientModal } from './RecipientModal';
import { SmartImage } from '../../../shared/ui/SmartImage';
import { Button } from '../../../shared/ui/Button';
import { formatPrice } from '../../../shared/lib/formatPrice';
import { PageLoader } from '../../../shared/ui/PageLoader';
import styles from './CheckoutLayout.module.css';

const getDeliveryLabel = (days: number | null | undefined): string => {
  if (!days) return 'Уточняется';
  const d = new Date();
  d.setDate(d.getDate() + days);
  if (days === 1) return `Завтра, ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  if (days === 2) return `Послезавтра, ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const CheckoutLayout = () => {
  const {
    data, error, isLoading, isSubmittingOrder,
    fetchCheckout, setDeliveryMethod, setPickupPoint,
    updateRecipient, placeOrder,
  } = useCheckoutStore();

  const [isAddressOpen, setAddressOpen] = useState(false);
  const [isPvzOpen, setPvzOpen] = useState(false);
  const [isRecipientOpen, setRecipientOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  useEffect(() => { void fetchCheckout(); }, [fetchCheckout]);

  const total = useMemo(
    () => data?.cartItems.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0,
    [data?.cartItems],
  );

  const selectedMethod = data?.selectedDeliveryMethod ?? 'PICKUP_POINT';
  const methods = data?.deliveryMethods ?? [];
  const firstItem = data?.cartItems[0];

  const deliveryDays = firstItem?.etaMaxDays ?? firstItem?.deliveryDays ?? null;
  const deliveryDateLabel = getDeliveryLabel(deliveryDays);
  const deliverySubLabel = selectedMethod === 'PICKUP_POINT' ? 'Привезём в ПВЗ' : 'Курьером';

  const hasPhone = !!(data?.recipient.phone?.trim());
  const hasName  = !!(data?.recipient.name?.trim());
  const canPay   = hasPhone && hasName;

  const handlePay = async () => {
    if (isPaying || !canPay) return;
    setIsPaying(true);
    try {
      const result = await placeOrder();
      if (result) window.location.href = result.paymentUrl;
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading && !data) return <PageLoader />;
  if (!data) return <p className={styles.state}>{error ?? 'Ошибка загрузки'}</p>;

  const addressText =
    selectedMethod === 'PICKUP_POINT'
      ? (data.selectedPickupPoint?.addressFull ?? 'Выберите пункт выдачи')
      : data.address
        ? `${data.address.line1}, ${data.address.city}`
        : 'Выберите адрес доставки';

  const recipientText = data.recipient.name || data.recipient.phone
    ? [data.recipient.name, data.recipient.phone].filter(Boolean).join(' · ')
    : null;

  /* ── Reusable JSX blocks ── */

  const carousel = (
    <DeliveryMethodSelector
      methods={methods}
      selected={selectedMethod}
      onSelect={(code) => void setDeliveryMethod(code)}
    />
  );

  const addressRow = (
    <button
      type="button"
      className={styles.addressRow}
      onClick={() => setAddressOpen(true)}
    >
      <span className={styles.addrIcon}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </span>
      <div className={styles.addrBody}>
        <span className={styles.addrMain}>{addressText}</span>
        <span className={styles.addrSub}>
          {recipientText ? `Получатель: ${recipientText}` : 'Укажите получателя →'}
        </span>
      </div>
      <svg className={styles.addrChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );

  const deliveryCard = (
    <div className={styles.deliveryCard}>
      <div className={styles.dateRow}>
        <span className={styles.checkBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <div>
          <p className={styles.dateLabel}>{deliveryDateLabel}</p>
          <p className={styles.dateSub}>{deliverySubLabel}</p>
        </div>
      </div>

      {firstItem && (
        <article className={styles.orderItem}>
          <SmartImage src={firstItem.image ?? ''} alt={firstItem.title} sizePreset="card" />
          <div className={styles.orderItemMeta}>
            <span className={styles.orderItemTitle}>{firstItem.title}</span>
            <strong className={styles.orderItemPrice}>
              {formatPrice(firstItem.price * firstItem.quantity)}
            </strong>
          </div>
        </article>
      )}
    </div>
  );

  const totalsCard = (
    <div className={styles.totalsCard}>
      {/* Price rows */}
      <div className={styles.priceList}>
        <div className={styles.priceRow}>
          <span>{data.cartItems.length} товар{data.cartItems.length !== 1 ? 'а' : ''}</span>
          <span>{formatPrice(total)}</span>
        </div>
        <div className={styles.priceRow}>
          <button type="button" className={styles.expandTrigger}>
            Выгода <span className={styles.caret}>∨</span>
          </button>
          <span className={styles.saving}>−0 ₽</span>
        </div>
        <div className={styles.priceRow}>
          <button type="button" className={styles.expandTrigger}>
            Доставка и сервисы <span className={styles.caret}>∨</span>
          </button>
          <span>0 ₽</span>
        </div>

        {/* Promo */}
        <div className={styles.promoRow}>
          <input
            type="text"
            className={styles.promoInput}
            placeholder="Промокод"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
          />
          {promoCode.trim() && (
            <button type="button" className={styles.promoApply}>Применить</button>
          )}
        </div>
      </div>

      <div className={styles.divider} />

      {/* Total */}
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Оплата онлайн</span>
        <strong className={styles.totalAmount}>{formatPrice(total)}</strong>
      </div>
    </div>
  );

  const phoneHint = !canPay && (
    <p className={styles.phoneHint}>
      {!hasName && !hasPhone
        ? 'Укажите ФИО и телефон получателя — '
        : !hasName
        ? 'Укажите ФИО получателя — '
        : 'Укажите телефон получателя — '}
      <button type="button" className={styles.phoneHintLink} onClick={() => setAddressOpen(true)}>
        добавить
      </button>
    </p>
  );

  const payBtn = (
    <Button
      className={styles.payBtn}
      isLoading={isSubmittingOrder || isPaying}
      disabled={!canPay || isPaying || isSubmittingOrder}
      onClick={() => void handlePay()}
    >
      Оплатить
    </Button>
  );

  return (
    <>
      <div className={styles.layout}>
        <h1 className={styles.pageTitle}>Оформление</h1>

        {/* ── Left column ── */}
        <div className={styles.leftCol}>
          <div className={styles.mainCard}>
            {carousel}
            {addressRow}
          </div>
          {deliveryCard}
        </div>

        {/* ── Right column ── */}
        <div className={styles.rightCol}>
          {totalsCard}
          {error && <p className={styles.error}>{error}</p>}
          {phoneHint}
          {payBtn}
        </div>
      </div>

      <AddressModal
        isOpen={isAddressOpen}
        onClose={() => setAddressOpen(false)}
        recipient={data.recipient}
        pickupPoint={data.selectedPickupPoint}
        onEditRecipient={() => setRecipientOpen(true)}
        onAddPickupPoint={() => setPvzOpen(true)}
      />

      <CdekPvzPickerModal
        isOpen={isPvzOpen}
        onClose={() => setPvzOpen(false)}
        onSelect={(sel) => {
          void setPickupPoint({ provider: 'CDEK', pvzId: sel.pvzCode, addressFull: sel.addressFull, raw: sel.raw });
          setPvzOpen(false);
        }}
        city={data.address?.city ?? 'Москва'}
      />

      <RecipientModal
        isOpen={isRecipientOpen}
        onClose={() => setRecipientOpen(false)}
        initial={data.recipient}
        onSave={updateRecipient}
      />
    </>
  );
};
